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
// Simple in-memory rate limiter for Edge middleware.
// For production with multiple instances, use Vercel KV / Upstash Redis.
const rateLimitStore = new Map<string, { count: number; expiresAt: number }>()

// Rate limit configurations per route pattern
const RATE_LIMITS: { pattern: RegExp; maxRequests: number; windowMs: number }[] = [
  { pattern: /\/api\/auth\/(login|register|otp)/, maxRequests: 10, windowMs: 60_000 },
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

// Cleanup expired rate limit entries periodically
if (typeof globalThis !== 'undefined') {
  const cleanup = () => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.expiresAt) rateLimitStore.delete(key)
    }
  }
  // Run cleanup every 5 minutes
  setInterval(cleanup, 5 * 60 * 1000)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Generate a simple request ID (Edge-compatible)
  const requestId = request.headers.get('x-request-id') || generateRequestId()

  // Generate a per-request nonce for CSP (Edge-compatible)
  const nonce = generateNonce()

  // Forward the nonce to server components via request headers
  // so layout.tsx can read it with headers().get('x-nonce')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-request-id', requestId)

  // ===== Rate Limiting =====
  // Apply rate limits based on route pattern and client IP (API routes only)
  if (pathname.startsWith('/api/') && (request.method !== 'GET' || pathname.startsWith('/api/auth/'))) {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    // Find matching rate limit config
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

  // Create the response, forwarding modified request headers so server components
  // can access x-nonce via headers()
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // ===== Security Headers =====
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('X-Request-ID', requestId)

  // Content Security Policy — strict nonce-based (no unsafe-inline/unsafe-eval for scripts)
  // Midtrans Snap requires: script-src (snap.js), connect-src (API), frame-src (popup iframe), img-src (logos)
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' https://vercel.live https://va.vercel-scripts.com https://app.midtrans.com https://app.sandbox.midtrans.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://rzrfouzuxcxdbhadbppi.supabase.co https://vercel.live https://app.midtrans.com",
      "connect-src 'self' https://rzrfouzuxcxdbhadbppi.supabase.co wss: https://va.vercel-scripts.com https://app.midtrans.com https://app.sandbox.midtrans.com",
      "frame-src https://app.midtrans.com https://app.sandbox.midtrans.com",
      "frame-ancestors 'none'",
    ].join('; ')
  )

  // Expose nonce in response header for debugging / client-side use
  response.headers.set('X-Nonce', nonce)

  // Strict Transport Security (production only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // ===== CSRF Protection (API routes only) =====
  if (!pathname.startsWith('/api/')) {
    // Page requests: just ensure CSRF cookie exists, no validation needed
    if (request.method === 'GET') {
      const existingCsrfCookie = request.cookies.get('csrf-token')
      if (!existingCsrfCookie) {
        const { response: updatedResponse } = await issueCsrfToken(response)
        return updatedResponse
      }
    }
    return response
  }

  // For API GET requests: issue a new CSRF token if one doesn't exist
  if (request.method === 'GET') {
    const existingCsrfCookie = request.cookies.get('csrf-token')
    if (!existingCsrfCookie) {
      const { response: updatedResponse } = await issueCsrfToken(response)
      return updatedResponse
    }
    return response
  }

  // For API mutating requests (POST, PUT, DELETE, PATCH): validate CSRF
  const csrfResult = await validateCsrfRequest(request)
  if (!csrfResult.valid) {
    // Edge Runtime: cannot use Pino logger here, console.warn is the only option.
    // This is intentional — structured logging (Pino) requires Node.js runtime.
    console.warn(JSON.stringify({
      component: 'security',
      event: 'CSRF_VALIDATION_FAILED',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      path: pathname,
      reason: csrfResult.reason,
      method: request.method,
      timestamp: new Date().toISOString(),
    }))

    // Return a new CSRF token with the error response so client can retry
    const errorResponse = NextResponse.json(
      { success: false, error: 'CSRF validation failed. Please refresh and try again.' },
      { status: 403 }
    )
    const { response: securedResponse } = await issueCsrfToken(errorResponse)
    return securedResponse
  }

  // ===== Admin Route Protection =====
  if (pathname.startsWith('/api/admin/')) {
    const isSetupRoute = pathname === '/api/admin/setup' || pathname === '/api/admin/init'
    const hasAuth = request.headers.get('authorization') ||
      request.headers.get('cookie')?.includes('next-auth.session-token')

    if (!hasAuth && !isSetupRoute) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }
  }

  return response
}

/**
 * Generate a simple request ID (Edge Runtime compatible).
 * Uses crypto.getRandomValues which is available in Edge.
 */
function generateRequestId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
}

/**
 * Generate a cryptographic nonce for CSP (Edge Runtime compatible).
 * Uses crypto.getRandomValues which is available in Edge.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export const config = {
  matcher: [
    // Match all routes except static assets and Next.js internals
    '/((?!_next/static|_next/image|favicon\\.ico|icon-|apple-icon|manifest\\.json|og-image|sw\\.js|workbox).*)',
  ],
}
