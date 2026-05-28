import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateCsrfRequest, issueCsrfToken } from '@/lib/csrf'

// ==================== NEXT.JS PROXY (formerly middleware) ====================
// Next.js 16 renames "middleware" to "proxy".
// This proxy runs before all routes to add:
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
  { pattern: /\/api\/auth\/(login|register|otp)/, maxRequests: 10, windowMs: 60_000 },
  { pattern: /\/api\/payment\//, maxRequests: 5, windowMs: 60_000 },
  { pattern: /\/api\/wallet\//, maxRequests: 10, windowMs: 60_000 },
  { pattern: /\/api\/admin\//, maxRequests: 30, windowMs: 60_000 },
  { pattern: /\/api\/user\//, maxRequests: 15, windowMs: 60_000 },
  { pattern: /\/api\//, maxRequests: 60, windowMs: 60_000 }, // default
]

function checkProxyRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
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
      const result = checkProxyRateLimit(rateLimitKey, rateLimitConfig.maxRequests, rateLimitConfig.windowMs)

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
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('X-Request-ID', requestId)

  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' https://vercel.live https://va.vercel-scripts.com https://app.midtrans.com https://app.sandbox.midtrans.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://rzrfouzuxcxdbhadbppi.supabase.co https://images.unsplash.com https://vercel.live https://app.midtrans.com",
      "connect-src 'self' https://rzrfouzuxcxdbhadbppi.supabase.co wss: https://va.vercel-scripts.com https://app.midtrans.com https://app.sandbox.midtrans.com",
      "frame-src https://app.midtrans.com https://app.sandbox.midtrans.com",
      "frame-ancestors 'none'",
    ].join('; ')
  )

  response.headers.set('X-Nonce', nonce)

  // Strict Transport Security (production only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // ===== CSRF Protection =====
  // Always issue/refresh CSRF token on non-API GET requests (page loads).
  // This ensures the client always has a fresh token for subsequent mutating requests.
  if (!pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      const { response: updatedResponse } = await issueCsrfToken(response)
      return updatedResponse
    }
    return response
  }

  // For API GET requests: always refresh the CSRF cookie to keep it fresh.
  // Previously only issued if missing, but this caused issues when the token expired
  // but the cookie was still present (stale token). Always refreshing ensures
  // the client always has a valid token for subsequent mutating requests.
  if (request.method === 'GET') {
    const { response: updatedResponse } = await issueCsrfToken(response)
    return updatedResponse
  }

  // For API mutating requests (POST, PUT, DELETE, PATCH): validate CSRF
  const csrfResult = await validateCsrfRequest(request)
  if (!csrfResult.valid) {
    console.warn(JSON.stringify({
      component: 'security',
      event: 'CSRF_VALIDATION_FAILED',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      path: pathname,
      reason: csrfResult.reason,
      method: request.method,
      timestamp: new Date().toISOString(),
    }))

    const errorResponse = NextResponse.json(
      { success: false, error: 'Validasi CSRF gagal. Silakan refresh halaman dan coba lagi.' },
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
