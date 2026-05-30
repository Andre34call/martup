import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { clearSessionCookies } from '@/lib/session-cookie'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/logout-all - Invalidate all sessions for the current user.
 *
 * This works by incrementing the user's `tokenVersion` in the database.
 * All existing HMAC tokens include the old tokenVersion and will be rejected
 * on the next request, effectively logging out all devices.
 *
 * The current device is also logged out (session cookies cleared).
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // Increment tokenVersion to invalidate all existing sessions
    await db.user.update({
      where: { id: authResult.user.id },
      data: {
        tokenVersion: { increment: 1 },
      },
    })

    logger.info({ component: 'auth', userId: authResult.user.id }, 'All sessions invalidated (logout all devices)')

    // Clear the current session cookies too
    const response = NextResponse.json({
      success: true,
      message: 'Semua perangkat telah logout. Silakan login kembali.',
    })
    clearSessionCookies(response)
    return response
  } catch (error: unknown) {
    logger.error({ err: error }, 'Logout all devices error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
