import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { clearSessionCookies } from '@/lib/session-cookie'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/logout - Log out the user and invalidate the session.
 *
 * SECURITY: This increments the user's `tokenVersion` in the database,
 * which invalidates ALL existing HMAC tokens (both cookie and bearer).
 * This prevents an attacker who stole a token from continuing to use it
 * after the user logs out.
 *
 * The current session cookies are also cleared.
 */
export async function POST(request: NextRequest) {
  try {
    // Attempt to identify the user to invalidate their token
    const authResult = await verifyAuth(request)

    if (authResult.success) {
      // Increment tokenVersion to invalidate ALL existing tokens
      // (both the current session cookie and any stolen bearer tokens)
      await db.user.update({
        where: { id: authResult.user.id },
        data: {
          tokenVersion: { increment: 1 },
        },
      })
      logger.info({ component: 'auth', userId: authResult.user.id }, 'User logged out, tokenVersion incremented, all sessions invalidated')
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
