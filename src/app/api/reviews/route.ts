import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiGuard } from '@/lib/api-guard'
import { reviewCreateSchema, reviewUpdateSchema, reviewDeleteSchema } from '@/lib/validations'
import { errorResponse, parseJsonField } from '@/lib/api-utils'
import { sanitizeInput } from '@/lib/sanitize'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

type ReviewCreateInput = z.infer<typeof reviewCreateSchema>
type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>
type ReviewDeleteInput = z.infer<typeof reviewDeleteSchema>

// Recalculate the product's average rating and review count
async function recalculateProductRating(productId: string) {
  const stats = await db.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { id: true },
  })
  await db.product.update({
    where: { id: productId },
    data: {
      rating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0,
      reviewCount: stats._count.id,
    },
  })
}

// Recalculate the seller's average rating from their products' ratings
async function recalculateSellerRating(sellerId: string) {
  const products = await db.product.findMany({
    where: { sellerId, rating: { gt: 0 } },
    select: { rating: true },
  })
  if (products.length > 0) {
    const avgRating = products.reduce((sum, p) => sum + p.rating, 0) / products.length
    await db.seller.update({
      where: { id: sellerId },
      data: { rating: Math.round(avgRating * 10) / 10 },
    })
  } else {
    await db.seller.update({
      where: { id: sellerId },
      data: { rating: 0 },
    })
  }
}

// ==================== GET /api/reviews ====================
// Public endpoint - anyone can view reviews for a product (no guard needed)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return errorResponse('productId is required', 400)
    }

    const reviews = await db.review.findMany({
      where: { productId, isHidden: false },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Parse JSON images field for each review, include seller reply
    const parsedReviews = reviews.map((review) => ({
      ...review,
      images: parseJsonField(review.images),
      sellerReply: review.sellerReply || undefined,
      sellerReplyAt: review.sellerReplyAt || undefined,
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedReviews,
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Reviews GET error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}

// ==================== POST /api/reviews ====================
// Create a review - requires authentication
export async function POST(request: NextRequest) {
  try {
    // Guard handles: auth (user), rate limiting, CSRF, body validation via reviewCreateSchema
    const guard = await apiGuard<ReviewCreateInput>(request, {
      auth: 'user',
      rateLimit: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:reviews:create:' },
      schema: reviewCreateSchema,
    })
    if (guard instanceof NextResponse) return guard

    const { user, body } = guard
    const { productId, orderItemId, rating, images } = body

    // SECURITY: Sanitize user-generated content (Zod validates length, sanitizeInput handles XSS)
    const content = body.content ? sanitizeInput(body.content) : null

    // Verify the product exists
    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      return errorResponse('Product not found', 404)
    }

    // SECURITY: Verify orderItem belongs to the user, order is delivered, and product matches
    const orderItem = await db.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    })

    if (!orderItem) {
      return errorResponse('Order item not found', 404)
    }

    // Verify the order belongs to the authenticated user
    if (orderItem.order.userId !== user!.id) {
      return errorResponse('Forbidden - You can only review your own orders', 403)
    }

    // Verify the order item belongs to the specified product
    if (orderItem.productId !== productId) {
      return errorResponse('Order item does not belong to the specified product', 400)
    }

    // SECURITY: Verify the order status is 'delivered' (successful transaction)
    if (orderItem.order.status !== 'delivered') {
      return errorResponse('Hanya pesanan yang sudah diterima (delivered) yang dapat diulas', 400)
    }

    // SECURITY: Check that no review already exists for this orderItem (one review per item)
    const existingReview = await db.review.findUnique({
      where: { orderItemId },
    })

    if (existingReview) {
      return errorResponse('A review already exists for this order item', 409)
    }

    // Stringify images array if provided
    const imagesData = images && images.length > 0
      ? JSON.stringify(images)
      : null

    // Create review and update product rating in a transaction
    const review = await db.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          userId: user!.id,
          productId,
          orderItemId,
          rating,
          content: content || null,
          images: imagesData,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      })

      // Recalculate product rating
      const stats = await tx.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { id: true },
      })
      await tx.product.update({
        where: { id: productId },
        data: {
          rating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0,
          reviewCount: stats._count.id,
        },
      })

      return newReview
    })

    // Recalculate seller rating from their products' ratings (outside transaction to avoid deadlock)
    const updatedProduct = await db.product.findUnique({ where: { id: productId }, select: { sellerId: true } })
    if (updatedProduct) {
      await recalculateSellerRating(updatedProduct.sellerId)
    }

    // Parse images for response
    const parsedReview = {
      ...review,
      images: parseJsonField(review.images as string | null),
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedReview,
    }), { status: 201 })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Reviews POST error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}

// ==================== PUT /api/reviews ====================
// Update a review - requires authentication, user can only update own reviews
export async function PUT(request: NextRequest) {
  try {
    // Guard handles: auth (user), CSRF, body validation via reviewUpdateSchema
    const guard = await apiGuard<ReviewUpdateInput>(request, {
      auth: 'user',
      schema: reviewUpdateSchema,
    })
    if (guard instanceof NextResponse) return guard

    const { user, body } = guard
    const { reviewId, rating, images } = body

    // SECURITY: Sanitize user-generated content (Zod validates length, sanitizeInput handles XSS)
    const content = body.content !== undefined
      ? sanitizeInput(body.content)
      : undefined

    // Find the existing review
    const existingReview = await db.review.findUnique({
      where: { id: reviewId },
    })

    if (!existingReview) {
      return errorResponse('Review not found', 404)
    }

    // SECURITY: Verify the review belongs to the authenticated user
    if (existingReview.userId !== user!.id) {
      return errorResponse('Forbidden - You can only update your own reviews', 403)
    }

    // Build update data (only include fields that are provided)
    const updateData: Record<string, unknown> = {}
    if (rating !== undefined) updateData.rating = rating
    if (content !== undefined) updateData.content = content || null
    if (images !== undefined) {
      updateData.images = images.length > 0
        ? JSON.stringify(images)
        : null
    }

    // Update review and recalculate product rating in a transaction
    const updatedReview = await db.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id: reviewId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      })

      // Recalculate product rating
      const stats = await tx.review.aggregate({
        where: { productId: existingReview.productId ?? undefined },
        _avg: { rating: true },
        _count: { id: true },
      })
      await tx.product.update({
        where: { id: existingReview.productId ?? '' },
        data: {
          rating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0,
          reviewCount: stats._count.id,
        },
      })

      return review
    })

    // Recalculate seller rating from their products' ratings (outside transaction to avoid deadlock)
    const updatedProduct = await db.product.findUnique({ where: { id: existingReview.productId ?? '' }, select: { sellerId: true } })
    if (updatedProduct) {
      await recalculateSellerRating(updatedProduct.sellerId)
    }

    // Parse images for response
    const parsedReview = {
      ...updatedReview,
      images: parseJsonField(updatedReview.images as string | null),
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedReview,
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Reviews PUT error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}

// ==================== DELETE /api/reviews ====================
// Delete a review - requires authentication, user can only delete own reviews
export async function DELETE(request: NextRequest) {
  try {
    // Guard handles: auth (user), CSRF, body validation via reviewDeleteSchema
    const guard = await apiGuard<ReviewDeleteInput>(request, {
      auth: 'user',
      schema: reviewDeleteSchema,
    })
    if (guard instanceof NextResponse) return guard

    const { user, body } = guard
    const { reviewId } = body

    // Find the existing review
    const existingReview = await db.review.findUnique({
      where: { id: reviewId },
    })

    if (!existingReview) {
      return errorResponse('Review not found', 404)
    }

    // SECURITY: Verify the review belongs to the authenticated user
    if (existingReview.userId !== user!.id) {
      return errorResponse('Forbidden - You can only delete your own reviews', 403)
    }

    const productId = existingReview.productId

    if (!productId) {
      return errorResponse('Review tidak terhubung ke produk', 400)
    }

    // Delete review and recalculate product rating in a transaction
    await db.$transaction(async (tx) => {
      await tx.review.delete({
        where: { id: reviewId },
      })

      // Recalculate product rating after deletion
      const stats = await tx.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { id: true },
      })
      await tx.product.update({
        where: { id: productId },
        data: {
          rating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0,
          reviewCount: stats._count.id,
        },
      })
    })

    // Recalculate seller rating from their products' ratings (outside transaction to avoid deadlock)
    const updatedProduct = await db.product.findUnique({ where: { id: productId }, select: { sellerId: true } })
    if (updatedProduct) {
      await recalculateSellerRating(updatedProduct.sellerId)
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true, reviewId },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Reviews DELETE error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}
