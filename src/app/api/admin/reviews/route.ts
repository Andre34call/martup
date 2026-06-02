import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

function parseJsonField(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// GET /api/admin/reviews - List all reviews with filters
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'all', 'hidden', 'visible'
    const productId = searchParams.get('productId')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status === 'hidden') where.isHidden = true
    if (status === 'visible') where.isHidden = false
    if (productId) where.productId = productId

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatar: true, email: true } },
          product: { select: { id: true, name: true, seller: { select: { id: true, storeName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.review.count({ where }),
    ])

    const parsedReviews = reviews.map(review => ({
      ...review,
      images: parseJsonField(review.images),
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedReviews,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin reviews GET error')
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

// PUT /api/admin/reviews - Hide/unhide a review
export async function PUT(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { reviewId, isHidden } = body

    if (!reviewId) {
      return NextResponse.json({ success: false, error: 'reviewId is required' }, { status: 400 })
    }

    const review = await db.review.findUnique({ where: { id: reviewId } })
    if (!review) {
      return NextResponse.json({ success: false, error: 'Review tidak ditemukan' }, { status: 404 })
    }

    const updatedReview = await db.review.update({
      where: { id: reviewId },
      data: { isHidden: isHidden !== undefined ? isHidden : !review.isHidden },
    })

    // Recalculate product rating (hidden reviews shouldn't count)
    const stats = await db.review.aggregate({
      where: { productId: review.productId, isHidden: false },
      _avg: { rating: true },
      _count: { id: true },
    })
    await db.product.update({
      where: { id: review.productId || undefined },
      data: {
        rating: stats._avg.rating ?? 0,
        reviewCount: stats._count.id,
      },
    })

    return NextResponse.json(serializeDecimal({ success: true, data: updatedReview }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin reviews PUT error')
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

// DELETE /api/admin/reviews - Admin hard-deletes a review
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { reviewId } = body

    if (!reviewId) {
      return NextResponse.json({ success: false, error: 'reviewId is required' }, { status: 400 })
    }

    const review = await db.review.findUnique({ where: { id: reviewId } })
    if (!review) {
      return NextResponse.json({ success: false, error: 'Review tidak ditemukan' }, { status: 404 })
    }

    const productId = review.productId

    await db.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: reviewId } })

      // Recalculate product rating
      const stats = await tx.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { id: true },
      })
      await tx.product.update({
        where: { id: productId || undefined },
        data: {
          rating: stats._avg.rating ?? 0,
          reviewCount: stats._count.id,
        },
      })
    })

    return NextResponse.json({ success: true, data: { deleted: true, reviewId } })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin reviews DELETE error')
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
