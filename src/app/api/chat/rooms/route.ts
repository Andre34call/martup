import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit } from '@/lib/auth-middleware'

import { logger } from '@/lib/logger'

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
                    isVerified: true,
                    seller: {
                      select: {
                        id: true,
                        storeName: true,
                        storeSlug: true,
                        storeAvatar: true,
                        isVerified: true,
                        isPremium: true,
                        rating: true,
                        totalSales: true,
                        totalProducts: true,
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
        let product: { id: string; name: string; images: string; price: unknown; discountPrice: unknown } | null = null
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

        // Build other user info — supports both seller and non-seller users
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
                isVerified: otherUser.isVerified,
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
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Chat rooms GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/chat/rooms - Create or get existing chat room
// Supports both buyer→seller and user→user chat:
//   - sellerId: creates buyer→seller room (legacy, backward compatible)
//   - userId: creates user→user direct chat (new feature)
//   - productId: optional, links room to a product context
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
    const { sellerId, userId: targetUserId, productId } = body

    // Determine the other user's ID
    let otherUserId: string
    let roomContext: 'seller' | 'user' = 'user'

    if (targetUserId) {
      // New: Direct user-to-user chat
      otherUserId = targetUserId
      roomContext = 'user'
    } else if (sellerId) {
      // Legacy: Buyer→Seller chat (sellerId is the Seller record ID, not userId)
      roomContext = 'seller'
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
      otherUserId = seller.userId
    } else {
      return NextResponse.json(
        { success: false, error: 'sellerId or userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Cannot create chat room with yourself
    if (otherUserId === authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot create chat room with yourself' },
        { status: 400 }
      )
    }

    // Verify the target user exists and is active
    const targetUser = await db.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, name: true, avatar: true, isActive: true, isVerified: true },
    })

    if (!targetUser || !targetUser.isActive) {
      return NextResponse.json(
        { success: false, error: 'User not found or inactive' },
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

    const myId = authResult.user.id

    // Check if a room already exists between these two users
    // We find rooms where both users are participants
    const existingRooms = await db.chatRoom.findMany({
      where: {
        participants: {
          every: {
            userId: { in: [myId, otherUserId] },
          },
        },
      },
      include: {
        participants: true,
      },
    })

    // Filter to find a room where exactly these two users are participants
    const sortedIds = [myId, otherUserId].sort()
    const existingRoom = existingRooms.find((room) => {
      const participantIds = room.participants.map((p) => p.userId).sort()
      return (
        participantIds.length === 2 &&
        participantIds[0] === sortedIds[0] &&
        participantIds[1] === sortedIds[1]
      )
    })

    if (existingRoom) {
      // Return the existing room with other user info
      const otherUserSeller = await db.seller.findUnique({
        where: { userId: otherUserId },
        select: {
          id: true, storeName: true, storeSlug: true, storeAvatar: true,
          isVerified: true, isPremium: true, rating: true, totalSales: true, totalProducts: true,
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          id: existingRoom.id,
          productId: existingRoom.productId,
          createdAt: existingRoom.createdAt,
          updatedAt: existingRoom.updatedAt,
          isNew: false,
          otherUser: {
            id: targetUser.id,
            name: targetUser.name,
            avatar: targetUser.avatar,
            isVerified: targetUser.isVerified,
            seller: otherUserSeller,
          },
        },
      })
    }

    // Create new chat room with both participants
    const newRoom = await db.chatRoom.create({
      data: {
        productId: productId || null,
        participants: {
          create: [
            { userId: myId },
            { userId: otherUserId },
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
                isVerified: true,
                seller: {
                  select: {
                    id: true,
                    storeName: true,
                    storeSlug: true,
                    storeAvatar: true,
                    isVerified: true,
                    isPremium: true,
                    rating: true,
                    totalSales: true,
                    totalProducts: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // Build other user info for response
    const otherParticipant = newRoom.participants.find(p => p.userId === otherUserId)
    const otherUserInfo = otherParticipant?.user

    return NextResponse.json(
      {
        success: true,
        data: {
          id: newRoom.id,
          productId: newRoom.productId,
          createdAt: newRoom.createdAt,
          updatedAt: newRoom.updatedAt,
          isNew: true,
          otherUser: otherUserInfo
            ? {
                id: otherUserInfo.id,
                name: otherUserInfo.name,
                avatar: otherUserInfo.avatar,
                isVerified: otherUserInfo.isVerified,
                seller: otherUserInfo.seller,
              }
            : null,
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Chat rooms POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
