import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookies } from '@/lib/session-cookie'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/logout - Clear session cookies and log out the user.
 *
 * This endpoint clears both the httpOnly session cookie (martup_session)
 * and the auth flag cookie (martup_auth), effectively logging out the user.
 * The client should also clear localStorage and reset Zustand state.
 */
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logout berhasil',
    })
    // Clear session cookies — both martup_session and martup_auth
    clearSessionCookies(response)
    logger.info({ component: 'auth' }, 'User logged out, session cookies cleared')
    return response
  } catch (error) {
    logger.error({ err: error }, 'Logout error')
    // Even on error, try to clear cookies
    const response = NextResponse.json({
      success: true,
      message: 'Logout berhasil',
    })
    clearSessionCookies(response)
    return response
  }
}
