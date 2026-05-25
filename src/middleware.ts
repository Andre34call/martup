import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ==================== NEXT.JS MIDDLEWARE ====================
// This middleware runs before API routes to add basic protections
// Authentication is handled in the route handlers themselves via verifyAuth/verifyAdmin

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Security headers for all responses
  const response = NextResponse.next()

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Block direct access to admin API routes without any auth header
  // Exception: /api/admin/setup allows secret key for initial setup
  // This is a first line of defense - actual auth verification happens in the route handlers
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

  // Block suspicious requests to auth endpoints
  if (pathname.startsWith('/api/auth/')) {
    // Only allow POST to auth endpoints
    if (request.method !== 'POST' && pathname !== '/api/auth/session') {
      return NextResponse.json(
        { success: false, error: 'Method not allowed' },
        { status: 405 }
      )
    }
  }

  return response
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/api/auth/:path*',
  ],
}
