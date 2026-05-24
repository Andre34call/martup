import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/notifications - Fetch notifications for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
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
    console.error('Notifications GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/notifications - Mark notification(s) as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationId, markAll, userId } = body

    if (markAll && userId) {
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
    console.error('Notifications PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
