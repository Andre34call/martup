import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { clearSessionCookies } from '@/lib/session-cookie'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/logout - Clear session cookies and log out the user.
 *
 * This endpoint:
 * 1. Verifies the user's auth and gets their userId
 * 2. Increments the user's tokenVersion to invalidate all existing bearer tokens
 * 3. Clears both the httpOnly session cookie (martup_session)
 *    and the auth flag cookie (martup_auth), effectively logging out the user.
 * The client should also clear localStorage and reset Zustand state.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth and get userId — increment tokenVersion to invalidate all bearer tokens
    const authResult = await verifyAuth(request)
    if (authResult.success) {
      try {
        await db.user.update({
          where: { id: authResult.user.id },
          data: { tokenVersion: { increment: 1 } },
        })
        logger.info({ component: 'auth', userId: authResult.user.id }, 'User logged out, tokenVersion incremented')
      } catch (dbError) {
        // Log but don't fail logout if DB update fails
        logger.error({ err: dbError, component: 'auth' }, 'Failed to increment tokenVersion on logout')
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logout berhasil',
    })
    // Clear session cookies — both martup_session and martup_auth
    clearSessionCookies(response)
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
