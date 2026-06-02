import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// ==================== POST /api/user/fcm-token ====================
// Register or update the FCM (Firebase Cloud Messaging) token for the
// authenticated user. This enables push notifications to their device.

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const { token } = body as { token?: string }

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'FCM token is required' },
        { status: 400 }
      )
    }

    // Validate token length (FCM tokens are typically 152-256 chars)
    if (token.length > 512) {
      return NextResponse.json(
        { success: false, error: 'FCM token is too long' },
        { status: 400 }
      )
    }

    // Update the user's FCM token
    await db.user.update({
      where: { id: authResult.user.id },
      data: { fcmToken: token.trim() },
    })

    logger.info({
      component: 'fcm-token',
      userId: authResult.user.id,
      tokenPrefix: token.substring(0, 10) + '...',
    }, 'FCM token registered/updated')

    return NextResponse.json({
      success: true,
      message: 'FCM token updated successfully',
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'FCM token POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== DELETE /api/user/fcm-token ====================
// Remove the FCM token (e.g., when user logs out or disables push notifications)

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    await db.user.update({
      where: { id: authResult.user.id },
      data: { fcmToken: null },
    })

    logger.info({
      component: 'fcm-token',
      userId: authResult.user.id,
    }, 'FCM token removed')

    return NextResponse.json({
      success: true,
      message: 'FCM token removed successfully',
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'FCM token DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
