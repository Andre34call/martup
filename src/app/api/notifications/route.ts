import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiGuard } from '@/lib/api-guard'
import { notificationMarkReadSchema } from '@/lib/validations'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

// GET /api/notifications - Fetch notifications for a user
export async function GET(request: NextRequest) {
  try {
    const guard = await apiGuard(request, { auth: 'user', csrf: false })
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return errorResponse('userId is required', 400)
    }

    // SECURITY: Users can only read their own notifications
    if (userId !== guard.user!.id) {
      return errorResponse('Forbidden - You can only view your own notifications', 403)
    }

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const unreadCount = notifications.filter((n) => !n.isRead).length

    return successResponse({ notifications, unreadCount })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Notifications GET error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}

// PUT /api/notifications - Mark notification(s) as read
export async function PUT(request: NextRequest) {
  try {
    const guard = await apiGuard(request, {
      auth: 'user',
      schema: notificationMarkReadSchema,
    })
    if (guard instanceof NextResponse) return guard

    const { notificationId, markAll, userId } = guard.body as {
      notificationId?: string
      markAll?: boolean
      userId?: string
    }

    if (markAll && userId) {
      // SECURITY: Users can only mark their own notifications
      if (userId !== guard.user!.id) {
        return errorResponse('Forbidden - You can only mark your own notifications', 403)
      }

      // Mark all notifications as read for this user
      await db.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      })

      return successResponse(null, 'All notifications marked as read')
    }

    if (!notificationId) {
      return errorResponse('notificationId is required (or provide markAll with userId)', 400)
    }

    // SECURITY: Verify the notification belongs to the authenticated user
    const existingNotification = await db.notification.findUnique({
      where: { id: notificationId },
    })

    if (!existingNotification) {
      return errorResponse('Notification not found', 404)
    }

    if (existingNotification.userId !== guard.user!.id) {
      return errorResponse('Forbidden - You can only update your own notifications', 403)
    }

    // Mark single notification as read
    const notification = await db.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    })

    return successResponse(notification)
  } catch (error: unknown) {
    logger.error({ err: error }, 'Notifications PUT error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}
