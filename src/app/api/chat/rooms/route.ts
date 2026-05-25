import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit } from '@/lib/auth-middleware'

// GET /api/chat/rooms - List chat rooms for authenticated user
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

    const userId = authResult.user.id

    // Find all chat rooms where user is a participant
    const participations = await db.chatParticipant.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                    seller: {
                      select: {
                        id: true,
                        storeName: true,
                        storeAvatar: true,
                        isVerified: true,
                      },
                    },
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { room: { updatedAt: 'desc' } },
    })

    // Build room list with other participant info, last message, unread count
    const rooms = await Promise.all(
      participations.map(async (participation) => {
        const room = participation.room

        // Find the other participant (not the current user)
        const otherParticipant = room.participants.find(
          (p) => p.userId !== userId
        )

        // Get unread count for the current user in this room
        const unreadCount = await db.chatMessage.count({
          where: {
            roomId: room.id,
            senderId: { not: userId },
            isRead: false,
            createdAt: { gt: participation.lastRead },
          },
        })

        // Get last message
        const lastMessage = room.messages.length > 0 ? room.messages[0] : null

        // Get product info if productId exists
        let product = null
        if (room.productId) {
          product = await db.product.findUnique({
            where: { id: room.productId },
            select: {
              id: true,
              name: true,
              images: true,
              price: true,
              discountPrice: true,
            },
          })
        }

        // Build other user info with seller data
        const otherUser = otherParticipant?.user || null
        const sellerInfo = otherUser?.seller || null

        return {
          id: room.id,
          productId: room.productId,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
          otherUser: otherUser
            ? {
                id: otherUser.id,
                name: otherUser.name,
                avatar: otherUser.avatar,
                seller: sellerInfo,
              }
            : null,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                type: lastMessage.type,
                senderId: lastMessage.senderId,
                createdAt: lastMessage.createdAt,
              }
            : null,
          lastMessageTime: lastMessage?.createdAt || room.createdAt,
          unreadCount,
          product,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: rooms,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Chat rooms GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/chat/rooms - Create or get existing chat room
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

    // SECURITY: Rate limit room creation
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(`chat-room:${clientIp}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { sellerId, productId } = body

    if (!sellerId) {
      return NextResponse.json(
        { success: false, error: 'sellerId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Cannot create chat room with yourself
    if (sellerId === authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot create chat room with yourself' },
        { status: 400 }
      )
    }

    // Verify the seller exists
    const seller = await db.seller.findUnique({
      where: { id: sellerId },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, isActive: true },
        },
      },
    })

    if (!seller || !seller.user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Seller not found or inactive' },
        { status: 404 }
      )
    }

    // Verify product exists if productId is provided
    if (productId) {
      const product = await db.product.findUnique({
        where: { id: productId },
      })
      if (!product) {
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404 }
        )
      }
    }

    const buyerId = authResult.user.id
    const sellerUserId = seller.userId

    // Check if a room already exists between these two users
    // We find rooms where both users are participants
    const existingRooms = await db.chatRoom.findMany({
      where: {
        participants: {
          every: {
            userId: { in: [buyerId, sellerUserId] },
          },
        },
      },
      include: {
        participants: true,
      },
    })

    // Filter to find a room where exactly these two users are participants
    const existingRoom = existingRooms.find((room) => {
      const participantIds = room.participants.map((p) => p.userId).sort()
      return (
        participantIds.length === 2 &&
        participantIds[0] === [buyerId, sellerUserId].sort()[0] &&
        participantIds[1] === [buyerId, sellerUserId].sort()[1]
      )
    })

    if (existingRoom) {
      // Return the existing room
      return NextResponse.json({
        success: true,
        data: {
          id: existingRoom.id,
          productId: existingRoom.productId,
          createdAt: existingRoom.createdAt,
          updatedAt: existingRoom.updatedAt,
          isNew: false,
        },
      })
    }

    // Create new chat room with both participants
    const newRoom = await db.chatRoom.create({
      data: {
        productId: productId || null,
        participants: {
          create: [
            { userId: buyerId },
            { userId: sellerUserId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                seller: {
                  select: {
                    id: true,
                    storeName: true,
                    storeAvatar: true,
                    isVerified: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: newRoom.id,
          productId: newRoom.productId,
          createdAt: newRoom.createdAt,
          updatedAt: newRoom.updatedAt,
          isNew: true,
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Chat rooms POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
