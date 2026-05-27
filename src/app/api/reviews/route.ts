import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit } from '@/lib/auth-middleware'
import { sanitizeInput } from '@/lib/sanitize'
import { serializeDecimal } from '@/lib/decimal-utils'

import { logger } from '@/lib/logger'
// ==================== HELPERS ====================

// Safely parse a JSON field (images stored as JSON string)
function parseJsonField(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

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
      rating: stats._avg.rating ?? 0,
      reviewCount: stats._count.id,
    },
  })
}

// ==================== GET /api/reviews ====================
// Public endpoint - anyone can view reviews for a product
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
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

    // Parse JSON images field for each review
    const parsedReviews = reviews.map((review) => ({
      ...review,
      images: parseJsonField(review.images),
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedReviews,
    }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Reviews GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== POST /api/reviews ====================
// Create a review - requires authentication
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

    // SECURITY: Rate limit review creation (max 10 per minute)
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(`review-create:${authResult.user.id}:${clientIp}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again in 1 minute.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { productId, orderItemId, rating, images } = body

    // SECURITY: Sanitize user-generated content
    const content = sanitizeInput(body.content || '')

    // Validate required fields
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'rating is required and must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Validate content length
    if (content && typeof content === 'string' && content.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'content must be at most 1000 characters' },
        { status: 400 }
      )
    }

    // Verify the product exists
    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // SECURITY: If orderItemId is provided, verify it belongs to the user's order
    if (orderItemId) {
      const orderItem = await db.orderItem.findUnique({
        where: { id: orderItemId },
        include: { order: true },
      })

      if (!orderItem) {
        return NextResponse.json(
          { success: false, error: 'Order item not found' },
          { status: 404 }
        )
      }

      // Verify the order belongs to the authenticated user
      if (orderItem.order.userId !== authResult.user.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden - You can only review your own orders' },
          { status: 403 }
        )
      }

      // Verify the order item belongs to the specified product
      if (orderItem.productId !== productId) {
        return NextResponse.json(
          { success: false, error: 'Order item does not belong to the specified product' },
          { status: 400 }
        )
      }

      // SECURITY: Check that no review already exists for this orderItem (one review per item)
      const existingReview = await db.review.findUnique({
        where: { orderItemId },
      })

      if (existingReview) {
        return NextResponse.json(
          { success: false, error: 'A review already exists for this order item' },
          { status: 409 }
        )
      }
    }

    // Stringify images array if provided
    const imagesData = images && Array.isArray(images) && images.length > 0
      ? JSON.stringify(images)
      : null

    // Create review and update product rating in a transaction
    const review = await db.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          userId: authResult.user.id,
          productId,
          orderItemId: orderItemId || null,
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
          rating: stats._avg.rating ?? 0,
          reviewCount: stats._count.id,
        },
      })

      return newReview
    })

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
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Reviews POST error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== PUT /api/reviews ====================
// Update a review - requires authentication, user can only update own reviews
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
    const { reviewId, rating, images } = body

    // SECURITY: Sanitize user-generated content
    const content = body.content !== undefined ? sanitizeInput(body.content) : undefined

    if (!reviewId) {
      return NextResponse.json(
        { success: false, error: 'reviewId is required' },
        { status: 400 }
      )
    }

    // Validate rating if provided
    if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      return NextResponse.json(
        { success: false, error: 'rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Validate content length if provided
    if (content && typeof content === 'string' && content.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'content must be at most 1000 characters' },
        { status: 400 }
      )
    }

    // Find the existing review
    const existingReview = await db.review.findUnique({
      where: { id: reviewId },
    })

    if (!existingReview) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the review belongs to the authenticated user
    if (existingReview.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only update your own reviews' },
        { status: 403 }
      )
    }

    // Build update data (only include fields that are provided)
    const updateData: Record<string, unknown> = {}
    if (rating !== undefined) updateData.rating = rating
    if (content !== undefined) updateData.content = content || null
    if (images !== undefined) {
      updateData.images = Array.isArray(images) && images.length > 0
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
        where: { productId: existingReview.productId },
        _avg: { rating: true },
        _count: { id: true },
      })
      await tx.product.update({
        where: { id: existingReview.productId },
        data: {
          rating: stats._avg.rating ?? 0,
          reviewCount: stats._count.id,
        },
      })

      return review
    })

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
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Reviews PUT error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== DELETE /api/reviews ====================
// Delete a review - requires authentication, user can only delete own reviews
export async function DELETE(request: NextRequest) {
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
    const { reviewId } = body

    if (!reviewId) {
      return NextResponse.json(
        { success: false, error: 'reviewId is required' },
        { status: 400 }
      )
    }

    // Find the existing review
    const existingReview = await db.review.findUnique({
      where: { id: reviewId },
    })

    if (!existingReview) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the review belongs to the authenticated user
    if (existingReview.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only delete your own reviews' },
        { status: 403 }
      )
    }

    const productId = existingReview.productId

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
          rating: stats._avg.rating ?? 0,
          reviewCount: stats._count.id,
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: { deleted: true, reviewId },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Reviews DELETE error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
