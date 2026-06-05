import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateCsrfRequest, issueCsrfToken } from '@/lib/csrf'

// ==================== NEXT.JS MIDDLEWARE ====================
// This middleware runs before all routes to add:
// 1. Security headers (CSP with nonce, HSTS, etc.)
// 2. CSRF protection (double-submit cookie)
// 3. Rate limiting (in-memory for Edge, Redis for production)
// 4. Request ID tracking
// 5. CSP nonce generation and forwarding to server components
// Authentication is handled in route handlers via verifyAuth/verifyAdmin
//
// NOTE: This runs in Edge Runtime — only Web APIs are available.
// No Node.js modules (crypto, fs, etc.) can be used here.

// ==================== EDGE-COMPATIBLE RATE LIMITING ====================
const rateLimitStore = new Map<string, { count: number; expiresAt: number }>()

// Rate limit configurations per route pattern
const RATE_LIMITS: { pattern: RegExp; maxRequests: number; windowMs: number }[] = [
  { pattern: /\/api\/auth\/(login|register|otp)/, maxRequests: 20, windowMs: 60_000 },
  { pattern: /\/api\/payment\//, maxRequests: 5, windowMs: 60_000 },
  { pattern: /\/api\/wallet\//, maxRequests: 10, windowMs: 60_000 },
  { pattern: /\/api\/admin\//, maxRequests: 30, windowMs: 60_000 },
  { pattern: /\/api\/user\//, maxRequests: 15, windowMs: 60_000 },
  { pattern: /\/api\//, maxRequests: 60, windowMs: 60_000 }, // default
]

function checkMiddlewareRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.expiresAt) {
    rateLimitStore.set(key, { count: 1, expiresAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.expiresAt }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.expiresAt }
}

// Lazy cleanup: remove expired rate limit entries on each request
function cleanupRateLimitStore() {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.expiresAt) rateLimitStore.delete(key)
  }
}

export async function proxy(request: NextRequest) {
  try {
    return await _proxyInner(request)
  } catch (err) {
    // SECURITY: Fail-closed — if the proxy crashes, block the request instead of letting it through.
    // A broken proxy should never bypass security checks (CSRF, rate limiting, etc.).
    console.error('[PROXY ERROR]', err)
    return NextResponse.json({ success: false, error: 'Internal security error' }, { status: 500 })
  }
}

async function _proxyInner(request: NextRequest) {
  // Lazy cleanup on each request instead of unreliable setInterval in Edge
  cleanupRateLimitStore()

  const { pathname } = request.nextUrl

  // Generate a simple request ID (Edge-compatible)
  const requestId = request.headers.get('x-request-id') || generateRequestId()

  // Generate a per-request nonce for CSP (Edge-compatible)
  const nonce = generateNonce()

  // Forward the nonce to server components via request headers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-request-id', requestId)

  // ===== Rate Limiting =====
  if (pathname.startsWith('/api/') && (request.method !== 'GET' || pathname.startsWith('/api/auth/'))) {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    const rateLimitConfig = RATE_LIMITS.find(rl => rl.pattern.test(pathname))
    if (rateLimitConfig) {
      const rateLimitKey = `${rateLimitConfig.pattern.source}:${clientIp}`
      const result = checkMiddlewareRateLimit(rateLimitKey, rateLimitConfig.maxRequests, rateLimitConfig.windowMs)

      if (!result.allowed) {
        const errorResponse = NextResponse.json(
          { success: false, error: 'Terlalu banyak request. Coba lagi nanti.' },
          { status: 429 }
        )
        errorResponse.headers.set('X-RateLimit-Limit', String(rateLimitConfig.maxRequests))
        errorResponse.headers.set('X-RateLimit-Remaining', '0')
        errorResponse.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))
        errorResponse.headers.set('Retry-After', String(Math.ceil((result.resetAt - Date.now()) / 1000)))
        return errorResponse
      }
    }
  }

  // Create the response, forwarding modified request headers
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // ===== Security Headers =====
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  response.headers.set('X-Request-ID', requestId)

  // Content Security Policy
  // NOTE: NextAuth and Next.js require 'unsafe-eval' and 'unsafe-inline' for their
  // internal scripts (e.g., OAuth callback redirect pages, hydration, React DevTools).
  // IMPORTANT: When nonce is present in script-src, browsers IGNORE 'unsafe-inline'
  // per CSP spec. So we must NOT include nonce alongside 'unsafe-inline' — pick one.
  // We use 'unsafe-inline' + 'unsafe-eval' for compatibility with NextAuth/Next.js.
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com https://app.midtrans.com https://app.sandbox.midtrans.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://rzrfouzuxcxdbhadbppi.supabase.co https://images.unsplash.com https://vercel.live https://app.midtrans.com https://lh3.googleusercontent.com",
      "connect-src 'self' https://rzrfouzuxcxdbhadbppi.supabase.co wss: https://va.vercel-scripts.com https://app.midtrans.com https://app.sandbox.midtrans.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
      "frame-src https://app.midtrans.com https://app.sandbox.midtrans.com https://accounts.google.com",
      "frame-ancestors 'none'",
    ].join('; ')
  )

  response.headers.set('X-Nonce', nonce)

  // Strict Transport Security (production only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // ===== CSRF Protection =====
  // Issue CSRF token on page loads (non-API GET requests).
  // This ensures the client has a fresh token for subsequent mutating requests.
  // Wrapped in try/catch to prevent proxy crash if CSRF module has issues.
  if (!pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      try {
        const { response: updatedResponse } = await issueCsrfToken(response)
        return updatedResponse
      } catch {
        // CSRF token generation failed — return response without CSRF cookie
        // The page will still load, but mutating requests may fail until CSRF is fixed
        return response
      }
    }
    return response
  }

  // For API GET requests: only issue a CSRF cookie if one doesn't already exist.
  if (request.method === 'GET') {
    const existingCsrfCookie = request.cookies.get('csrf-token')?.value
    if (!existingCsrfCookie) {
      try {
        const { response: updatedResponse } = await issueCsrfToken(response)
        return updatedResponse
      } catch {
        return response
      }
    }
    return response
  }

  // For API mutating requests (POST, PUT, DELETE, PATCH): validate CSRF
  // SECURITY: CSRF is enforced by default. Set CSRF_ENFORCE=false to switch to monitoring mode.
  // EXEMPTION: Internal requests with x-internal-secret header are exempted (e.g., NextAuth sync-user)
  // EXEMPTION: NextAuth built-in routes are exempted — NextAuth has its own CSRF protection
  //   and uses a different mechanism (csrfToken body field + cookie). Our custom CSRF would
  //   block NextAuth's signIn/signout POST requests, breaking Google OAuth login.
  // EXEMPTION: Custom unauthenticated auth routes (login, register, forgot-password, etc.)
  //   These are pre-authentication routes — CSRF protection is unnecessary because there's
  //   no authenticated session to protect. They have their own rate limiting.
  //   The client-side api-client.ts also skips CSRF tokens for these routes.
  // SECURITY: Validate the internal secret VALUE, not just header existence.
  // Only requests with the correct NEXTAUTH_SECRET as the header value are exempt.
  const internalSecret = request.headers.get('x-internal-secret')
  // Use env.INTERNAL_API_SECRET which falls back to NEXTAUTH_SECRET
  // This must match what auth.ts uses when calling sync-user
  const expectedSecret = process.env.INTERNAL_API_SECRET || process.env.NEXTAUTH_SECRET || ''
  const isInternalRequest = !!internalSecret && !!expectedSecret && internalSecret === expectedSecret
  const isNextAuthRoute = pathname.startsWith('/api/auth/signin') ||
    pathname.startsWith('/api/auth/callback') ||
    pathname === '/api/auth/csrf' ||
    pathname === '/api/auth/session' ||
    pathname === '/api/auth/signout' ||
    pathname === '/api/auth/_log'
  const isCsrfExemptAuthRoute = pathname === '/api/auth/login' ||
    pathname === '/api/auth/register' ||
    pathname === '/api/auth/forgot-password' ||
    pathname === '/api/auth/reset-password' ||
    pathname === '/api/auth/verify-email' ||
    pathname === '/api/auth/resend-verification' ||
    pathname === '/api/auth/otp/send' ||
    pathname === '/api/auth/otp/verify' ||
    pathname === '/api/auth/sync-user' ||
    pathname === '/api/auth/diagnostic' ||
    pathname === '/api/auth/login-diagnostic' ||
    pathname.startsWith('/api/diagnostics/') ||
    pathname === '/api/auth/google-diagnostic'
  let csrfResult: { valid: boolean; reason?: string } = { valid: true }
  if (!isInternalRequest && !isNextAuthRoute && !isCsrfExemptAuthRoute) {
    csrfResult = await validateCsrfRequest(request)
  }
  if (!csrfResult.valid) {
    const isEnforce = process.env.CSRF_ENFORCE !== 'false' // Enforce by default

    console.warn(JSON.stringify({
      component: 'security',
      event: 'CSRF_VALIDATION_FAILED',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      path: pathname,
      reason: csrfResult.reason,
      method: request.method,
      enforced: isEnforce,
      timestamp: new Date().toISOString(),
    }))

    if (isEnforce) {
      // ENFORCEMENT MODE: Block the request
      // IMPORTANT: The error message MUST contain 'CSRF' (case-insensitive) so that
      // the client-side fetchWithCsrfRetry can detect CSRF failures and auto-retry
      // with a fresh token. Without this keyword, the retry mechanism never triggers.
      const errorResponse = NextResponse.json(
        { success: false, error: 'CSRF validation failed. Silakan refresh halaman dan coba lagi.', code: 'CSRF_ERROR' },
        { status: 403 }
      )
      const { response: securedResponse } = await issueCsrfToken(errorResponse)
      return securedResponse
    }
    // MONITORING MODE: Log but allow the request through (only if CSRF_ENFORCE=false)
  }

  // ===== Admin Route Protection =====
  // Quick pre-check before route handlers do full auth verification
  if (pathname.startsWith('/api/admin/')) {
    const isSetupRoute = pathname === '/api/admin/setup' || pathname === '/api/admin/init'
    const hasAuth = request.headers.get('authorization') ||
      request.headers.get('cookie')?.includes('next-auth.session-token') ||
      request.headers.get('cookie')?.includes('martup_session')

    if (!hasAuth && !isSetupRoute) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }
  }

  return response
}

// Alias for backward compatibility (Next.js 16 uses "proxy" convention)
export { proxy as middleware }

function generateRequestId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
}

function generateNonce(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon-|apple-icon|manifest\\.json|og-image|sw\\.js|workbox).*)',
  ],
}
