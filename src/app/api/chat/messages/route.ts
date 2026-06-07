import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { sanitizeInput } from '@/lib/sanitize'

import { logger } from '@/lib/logger'
// Rate limiter: 30 chat messages per minute per user
const chatMsgLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:chat:msg-direct:' })

const MAX_MESSAGE_LENGTH = 2000
const VALID_MESSAGE_TYPES = ['text', 'image', 'product', 'order']

// GET /api/chat/messages - Get messages for a room
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const cursor = searchParams.get('cursor') // for pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'roomId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Verify user is a participant in this room
    const participant = await db.chatParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: authResult.user.id,
        },
      },
    })

    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You are not a participant in this room' },
        { status: 403 }
      )
    }

    // Build query with optional cursor-based pagination
    const whereClause: Record<string, unknown> = { roomId }
    if (cursor) {
      whereClause.createdAt = { lt: new Date(cursor) }
    }

    const messages = await db.chatMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        room: {
          select: { id: true, productId: true },
        },
      },
    })

    // Get sender info for each message
    const messagesWithSender = await Promise.all(
      messages.map(async (msg) => {
        const sender = await db.user.findUnique({
          where: { id: msg.senderId },
          select: {
            id: true,
            name: true,
            avatar: true,
            seller: {
              select: {
                id: true,
                storeName: true,
                storeAvatar: true,
              },
            },
          },
        })

        return {
          id: msg.id,
          roomId: msg.roomId,
          senderId: msg.senderId,
          content: msg.type === 'text' ? sanitizeInput(msg.content) : msg.content,
          type: msg.type,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
          sender: sender
            ? {
                id: sender.id,
                name: sender.name,
                avatar: sender.avatar,
                seller: sender.seller,
              }
            : null,
        }
      })
    )

    // Determine if there are more messages for pagination
    const hasMore = messages.length === limit
    const nextCursor = hasMore && messages.length > 0
      ? messages[messages.length - 1].createdAt.toISOString()
      : null

    return NextResponse.json({
      success: true,
      data: messagesWithSender,
      pagination: {
        hasMore,
        nextCursor,
      },
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Chat messages GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/chat/messages - Send a message
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // SECURITY: Rate limit message sending (max 30 per minute per user)
    const rateLimit = await chatMsgLimiter.check(authResult.user.id)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak pesan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { roomId, content, type } = body

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'roomId is required' },
        { status: 400 }
      )
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'content is required and must be a string' },
        { status: 400 }
      )
    }

    // SECURITY: Sanitize message content to prevent XSS
    const sanitizedContent = sanitizeInput(content).trim()

    if (sanitizedContent.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message content cannot be empty' },
        { status: 400 }
      )
    }

    if (sanitizedContent.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Validate message type
    const messageType = type && VALID_MESSAGE_TYPES.includes(type) ? type : 'text'

    // SECURITY: Verify user is a participant in this room
    const participant = await db.chatParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: authResult.user.id,
        },
      },
    })

    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You are not a participant in this room' },
        { status: 403 }
      )
    }

    // Create message and update room's updatedAt in a transaction
    const message = await db.$transaction(async (tx) => {
      // Create the message
      const newMessage = await tx.chatMessage.create({
        data: {
          roomId,
          senderId: authResult.user.id,
          content: sanitizedContent,
          type: messageType,
        },
      })

      // Update room's updatedAt timestamp (so room appears at top of list)
      await tx.chatRoom.update({
        where: { id: roomId },
        data: { updatedAt: new Date() },
      })

      return newMessage
    })

    // Get sender info for response
    const sender = await db.user.findUnique({
      where: { id: authResult.user.id },
      select: {
        id: true,
        name: true,
        avatar: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            storeAvatar: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: message.id,
          roomId: message.roomId,
          senderId: message.senderId,
          content: message.content,
          type: message.type,
          isRead: message.isRead,
          createdAt: message.createdAt,
          sender: sender
            ? {
                id: sender.id,
                name: sender.name,
                avatar: sender.avatar,
                seller: sender.seller,
              }
            : null,
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Chat messages POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/chat/messages - Mark messages as read
export async function PUT(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const { roomId } = body

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'roomId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Verify user is a participant in this room
    const participant = await db.chatParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: authResult.user.id,
        },
      },
    })

    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You are not a participant in this room' },
        { status: 403 }
      )
    }

    // Use transaction to update both participant's lastRead and mark messages as read
    await db.$transaction(async (tx) => {
      // Update participant's lastRead timestamp
      await tx.chatParticipant.update({
        where: {
          roomId_userId: {
            roomId,
            userId: authResult.user.id,
          },
        },
        data: { lastRead: new Date() },
      })

      // Mark all unread messages in the room as read
      // where the sender is NOT the current user (don't mark own messages)
      await tx.chatMessage.updateMany({
        where: {
          roomId,
          senderId: { not: authResult.user.id },
          isRead: false,
        },
        data: { isRead: true },
      })
    })

    return NextResponse.json({
      success: true,
      data: { roomId, markedAsRead: true },
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Chat messages PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
