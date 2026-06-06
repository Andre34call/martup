import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verifySuperAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

/**
 * GET /api/diagnostics/session
 *
 * Checks if a NextAuth session exists.
 *
 * SECURITY: Only accessible in development by super admins.
 * Returns 404 in production.
 */
export async function GET(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  // Require super admin
  const authResult = await verifySuperAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const session = await getServerSession(authOptions)

    // Check for cookies
    const cookies: Record<string, string> = {}
    request.cookies.getAll().forEach(c => {
      // Only show auth-related cookies, mask values
      if (c.name.includes('next-auth') || c.name.includes('martup')) {
        cookies[c.name] = c.value ? `${c.value.substring(0, 10)}... (${c.value.length} chars)` : '(empty)'
      }
    })

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      hasSession: !!session,
      session: session ? {
        user: {
          email: session.user?.email || null,
          name: session.user?.name || null,
          image: session.user?.image ? '(set)' : null,
        },
        expires: session.expires,
      } : null,
      cookies,
      nextauthUrl: process.env.NEXTAUTH_URL || '(not set)',
      vercelUrl: process.env.VERCEL_URL || '(not set)',
    })
  } catch (error) {
    logger.error({ err: error }, 'Session diagnostic error')
    return NextResponse.json({
      error: 'Failed to check session',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
