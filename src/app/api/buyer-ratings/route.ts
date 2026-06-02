import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { sanitizeInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import { ELEVATED_ROLES } from '@/lib/types'

// ==================== GET /api/buyer-ratings ====================
// Get buyer ratings — sellers can see ratings for a specific buyer
// Buyers can see their own ratings
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const { searchParams } = new URL(request.url)
    const buyerId = searchParams.get('buyerId')

    if (!buyerId) {
      return NextResponse.json(
        { success: false, error: 'buyerId is required' },
        { status: 400 }
      )
    }

    // Only allow: the buyer themselves, a seller who has transacted with them, or admin
    const isBuyer = authResult.user.id === buyerId
    const isAdmin = ELEVATED_ROLES.includes(authResult.user.role as typeof ELEVATED_ROLES[number])

    if (!isBuyer && !isAdmin) {
      // Check if this seller has any order with this buyer
      const seller = await db.seller.findUnique({
        where: { userId: authResult.user.id },
        select: { id: true },
      })

      if (!seller) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }

      const hasOrder = await db.order.findFirst({
        where: { sellerId: seller.id, userId: buyerId },
        select: { id: true },
      })

      if (!hasOrder) {
        return NextResponse.json(
          { success: false, error: 'You have not transacted with this buyer' },
          { status: 403 }
        )
      }
    }

    // Fetch ratings
    const limitParam = parseInt(searchParams.get('limit') || '20', 10)
    const limit = Math.min(Math.max(limitParam, 1), 50)
    const cursor = searchParams.get('cursor')

    const where: Record<string, unknown> = { buyerId }
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) }
    }

    const ratings = await db.buyerRating.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            avatar: true,
            seller: {
              select: {
                storeName: true,
                storeAvatar: true,
              },
            },
          },
        },
      },
    })

    const hasMore = ratings.length > limit
    const items = hasMore ? ratings.slice(0, limit) : ratings
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].createdAt.toISOString()
      : null

    // Get buyer's trust score summary
    const buyerStats = await db.user.findUnique({
      where: { id: buyerId },
      select: {
        buyerRating: true,
        buyerRatingCount: true,
        cancellationCount: true,
        returnCount: true,
        orders: {
          where: { status: { in: ['delivered', 'cancelled', 'refunded'] } },
          select: { status: true },
        },
      },
    })

    const totalOrders = buyerStats?.orders.length || 0
    const cancellationRate = totalOrders > 0
      ? ((buyerStats?.cancellationCount || 0) / totalOrders) * 100
      : 0
    const returnRate = totalOrders > 0
      ? ((buyerStats?.returnCount || 0) / totalOrders) * 100
      : 0

    // Trust level calculation
    const ratingScore = buyerStats?.buyerRating || 0
    const trustLevel = ratingScore >= 4.5 ? 'excellent'
      : ratingScore >= 3.5 ? 'good'
      : ratingScore >= 2.5 ? 'fair'
      : ratingScore > 0 ? 'poor'
      : 'new' // No ratings yet

    return NextResponse.json({
      success: true,
      data: items.map(r => ({
        id: r.id,
        orderId: r.orderId,
        rating: r.rating,
        content: r.content,
        tags: r.tags ? JSON.parse(r.tags) : [],
        createdAt: r.createdAt,
        seller: {
          id: r.seller.id,
          storeName: r.seller.seller?.storeName || r.seller.name,
          storeAvatar: r.seller.seller?.storeAvatar || r.seller.avatar,
        },
      })),
      buyerStats: {
        buyerRating: buyerStats?.buyerRating || 0,
        buyerRatingCount: buyerStats?.buyerRatingCount || 0,
        cancellationCount: buyerStats?.cancellationCount || 0,
        returnCount: buyerStats?.returnCount || 0,
        cancellationRate: Math.round(cancellationRate * 10) / 10,
        returnRate: Math.round(returnRate * 10) / 10,
        trustLevel,
        totalOrders,
      },
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Buyer ratings GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== POST /api/buyer-ratings ====================
// Seller rates a buyer after order completion
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Rate limit: 20 ratings per minute per seller
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(`buyer-rating:${authResult.user.id}:${clientIp}`, 20)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      )
    }

    // Verify user is a seller
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
      select: { id: true },
    })

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Only sellers can rate buyers' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { orderId, rating, content, tags } = body

    // Validation
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      )
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Verify the order exists, belongs to this seller, and is delivered
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        sellerId: true,
        userId: true,
        status: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.sellerId !== seller.id) {
      return NextResponse.json(
        { success: false, error: 'This order does not belong to you' },
        { status: 403 }
      )
    }

    if (order.status !== 'delivered') {
      return NextResponse.json(
        { success: false, error: 'You can only rate buyers after order is delivered' },
        { status: 400 }
      )
    }

    // Check if already rated
    const existingRating = await db.buyerRating.findUnique({
      where: { orderId },
      select: { id: true },
    })

    if (existingRating) {
      return NextResponse.json(
        { success: false, error: 'You have already rated this buyer for this order' },
        { status: 409 }
      )
    }

    // Sanitize content
    const sanitizedContent = content ? sanitizeInput(content).slice(0, 500) : null
    const sanitizedTags = tags ? JSON.stringify(tags.slice(0, 5)) : null

    // Create rating and update buyer's average rating in a transaction
    const newRating = await db.$transaction(async (tx) => {
      const created = await tx.buyerRating.create({
        data: {
          orderId,
          sellerId: authResult.user.id,
          buyerId: order.userId,
          rating,
          content: sanitizedContent,
          tags: sanitizedTags,
        },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              avatar: true,
              seller: {
                select: {
                  storeName: true,
                  storeAvatar: true,
                },
              },
            },
          },
        },
      })

      // Recalculate buyer's average rating
      const ratingAgg = await tx.buyerRating.aggregate({
        where: { buyerId: order.userId },
        _avg: { rating: true },
        _count: { rating: true },
      })

      const newAvg = ratingAgg._avg.rating || 0
      const newCount = ratingAgg._count.rating || 0

      // Update user's buyer rating
      await tx.user.update({
        where: { id: order.userId },
        data: {
          buyerRating: Math.round(newAvg * 100) / 100,
          buyerRatingCount: newCount,
        },
      })

      return created
    })

    logger.info(
      { sellerId: authResult.user.id, buyerId: order.userId, orderId, rating },
      'Seller rated buyer'
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          id: newRating.id,
          orderId: newRating.orderId,
          rating: newRating.rating,
          content: newRating.content,
          tags: newRating.tags ? JSON.parse(newRating.tags) : [],
          createdAt: newRating.createdAt,
          seller: {
            id: newRating.seller.id,
            storeName: newRating.seller.seller?.storeName || newRating.seller.name,
            storeAvatar: newRating.seller.seller?.storeAvatar || newRating.seller.avatar,
          },
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'Buyer rating POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
