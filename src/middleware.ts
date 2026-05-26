import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateCsrfRequest, issueCsrfToken } from '@/lib/csrf'

// ==================== NEXT.JS MIDDLEWARE ====================
// This middleware runs before API routes to add:
// 1. Security headers
// 2. CSRF protection (double-submit cookie)
// 3. Request ID tracking
// Authentication is handled in route handlers via verifyAuth/verifyAdmin
//
// NOTE: This runs in Edge Runtime — only Web APIs are available.
// No Node.js modules (crypto, fs, etc.) can be used here.

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Generate a simple request ID (Edge-compatible)
  const requestId = request.headers.get('x-request-id') || generateRequestId()

  // Security headers for all responses
  const response = NextResponse.next()

  // ===== Security Headers =====
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('X-Request-ID', requestId)

  // Content Security Policy (basic)
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://rzrfouzuxcxdbhadbppi.supabase.co https://vercel.live",
      "connect-src 'self' https://rzrfouzuxcxdbhadbppi.supabase.co wss: https://va.vercel-scripts.com",
      "frame-ancestors 'none'",
    ].join('; ')
  )

  // Strict Transport Security (production only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // ===== CSRF Protection =====
  // For GET requests: issue a new CSRF token if one doesn't exist
  if (request.method === 'GET') {
    const existingCsrfCookie = request.cookies.get('__Host-csrf-token')
    if (!existingCsrfCookie) {
      const { response: updatedResponse } = await issueCsrfToken(response)
      return updatedResponse
    }
    return response
  }

  // For mutating requests (POST, PUT, DELETE, PATCH): validate CSRF
  const csrfResult = await validateCsrfRequest(request)
  if (!csrfResult.valid) {
    // Log security event (Edge-safe: just console.warn, structured logging is for route handlers)
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
    const isSetupRoute = pathname === '/api/admin/setup'
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

export const config = {
  matcher: [
    '/api/:path*',
  ],
}
