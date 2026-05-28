import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// GET /api/followed-stores - Fetch all followed stores with seller details
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const followedStores = await db.followedStore.findMany({
      where: { userId },
      include: {
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: followedStores.map((fs) => ({
        id: fs.seller.id,
        storeName: fs.seller.storeName,
        storeSlug: fs.seller.storeSlug,
        storeAvatar: fs.seller.storeAvatar || '',
        isVerified: fs.seller.isVerified,
        isPremium: fs.seller.isPremium,
        rating: fs.seller.rating,
        totalProducts: fs.seller.totalProducts,
        totalSales: fs.seller.totalSales,
        followedAt: fs.createdAt,
      })),
      followedStoreIds: followedStores.map((fs) => fs.sellerId),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Followed Stores GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/followed-stores - Toggle follow/unfollow a store
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const { userId, sellerId } = body

    if (!userId || !sellerId) {
      return NextResponse.json(
        { success: false, error: 'userId and sellerId are required' },
        { status: 400 }
      )
    }

    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Verify seller exists
    const seller = await db.seller.findUnique({ where: { id: sellerId } })
    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Seller not found' },
        { status: 404 }
      )
    }

    // Check if already following
    const existing = await db.followedStore.findUnique({
      where: { userId_sellerId: { userId, sellerId } },
    })

    if (existing) {
      // Unfollow
      await db.followedStore.delete({
        where: { id: existing.id },
      })
      return NextResponse.json({
        success: true,
        action: 'unfollowed',
        sellerId,
      })
    } else {
      // Follow
      await db.followedStore.create({
        data: { userId, sellerId },
      })
      return NextResponse.json({
        success: true,
        action: 'followed',
        sellerId,
      })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Followed Stores POST error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
