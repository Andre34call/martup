import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { sanitizeInput } from '@/lib/sanitize'

const MAX_MESSAGE_LENGTH = 2000
const VALID_MESSAGE_TYPES = ['text', 'image', 'product', 'order']

// GET /api/chat/rooms/[id]/messages - Get messages for a chat room (SECURED)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const userId = authResult.user.id
    const { id: roomId } = await params

    // SECURITY: Verify user is a participant in this room
    const participant = await db.chatParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    })

    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Anda bukan peserta di chat ini' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 100) // Cap at 100

    const skip = (page - 1) * limit

    const messages = await db.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    // Return in chronological order with sanitized content
    const sortedMessages = messages.reverse().map((m) => ({
      ...m,
      content: m.type === 'text' ? sanitizeInput(m.content) : m.content,
      createdAt: m.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: sortedMessages,
    })
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/chat/rooms/[id]/messages - Send a message to a chat room (SECURED)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Require authentication — NO more senderId spoofing
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const userId = authResult.user.id
    const { id: roomId } = await params

    // Rate limit: 30 messages per minute per user
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`chat-msg:${clientIp}:${userId}`, 30)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak pesan. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    // SECURITY: Verify user is a participant in this room
    const participant = await db.chatParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    })

    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Anda bukan peserta di chat ini' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { content, type } = body

    // SECURITY: Sender is ALWAYS the authenticated user — cannot be spoofed
    // Validate content
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content wajib diisi' },
        { status: 400 }
      )
    }

    // SECURITY: Sanitize content to prevent XSS
    const sanitizedContent = type === 'text' ? sanitizeInput(content) : content.trim()

    if (sanitizedContent.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pesan tidak boleh kosong' },
        { status: 400 }
      )
    }

    if (sanitizedContent.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Pesan terlalu panjang (maks ${MAX_MESSAGE_LENGTH} karakter)` },
        { status: 400 }
      )
    }

    // Validate message type
    const messageType = type && VALID_MESSAGE_TYPES.includes(type) ? type : 'text'

    // Create message and update room in a transaction
    const message = await db.$transaction(async (tx) => {
      const newMessage = await tx.chatMessage.create({
        data: {
          roomId,
          senderId: userId, // Always from authenticated user
          content: sanitizedContent,
          type: messageType,
          isRead: false,
        },
      })

      // Update room's updatedAt timestamp
      await tx.chatRoom.update({
        where: { id: roomId },
        data: { updatedAt: new Date() },
      })

      return newMessage
    })

    return NextResponse.json({
      success: true,
      data: {
        ...message,
        createdAt: message.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Create message error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
