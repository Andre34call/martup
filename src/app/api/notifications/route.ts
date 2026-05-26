import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'

import { logger } from '@/lib/logger'
// GET /api/notifications - Fetch notifications for a user
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Users can only read their own notifications
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only view your own notifications' },
        { status: 403 }
      )
    }

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const unreadCount = notifications.filter((n) => !n.isRead).length

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Notifications GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/notifications - Mark notification(s) as read
export async function PUT(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const { notificationId, markAll, userId } = body

    if (markAll && userId) {
      // SECURITY: Users can only mark their own notifications
      if (userId !== authResult.user.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden - You can only mark your own notifications' },
          { status: 403 }
        )
      }

      // Mark all notifications as read for this user
      await db.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      })

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
      })
    }

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: 'notificationId is required (or provide markAll with userId)' },
        { status: 400 }
      )
    }

    // SECURITY: Verify the notification belongs to the authenticated user
    const existingNotification = await db.notification.findUnique({
      where: { id: notificationId },
    })

    if (!existingNotification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      )
    }

    if (existingNotification.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only update your own notifications' },
        { status: 403 }
      )
    }

    // Mark single notification as read
    const notification = await db.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    })

    return NextResponse.json({
      success: true,
      data: notification,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Notifications PUT error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
