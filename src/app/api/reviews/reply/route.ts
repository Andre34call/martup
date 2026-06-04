import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'

const reviewReplyLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:reviews:reply:' })

import { sanitizeInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

// PUT /api/reviews/reply - Seller replies to a review
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // Rate limit
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await reviewReplyLimiter.check(`${authResult.user.id}:${clientIp}`)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { reviewId, reply } = body

    if (!reviewId) {
      return NextResponse.json({ success: false, error: 'reviewId is required' }, { status: 400 })
    }

    const sanitizedReply = sanitizeInput(reply || '')
    if (!sanitizedReply || typeof sanitizedReply !== 'string' || sanitizedReply.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Balasan tidak boleh kosong' }, { status: 400 })
    }
    if (sanitizedReply.length > 500) {
      return NextResponse.json({ success: false, error: 'Balasan maksimal 500 karakter' }, { status: 400 })
    }

    // Find the review
    const review = await db.review.findUnique({
      where: { id: reviewId },
      include: { product: { select: { sellerId: true, name: true } } },
    })

    if (!review) {
      return NextResponse.json({ success: false, error: 'Review tidak ditemukan' }, { status: 404 })
    }

    // Verify the authenticated user is the seller of the product
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
      select: { id: true },
    })

    if (!seller || !review.product || review.product.sellerId !== seller.id) {
      return NextResponse.json(
        { success: false, error: 'Hanya penjual produk ini yang dapat membalas review' },
        { status: 403 }
      )
    }

    // Update the review with seller reply
    const updatedReview = await db.review.update({
      where: { id: reviewId },
      data: {
        sellerReply: sanitizedReply.trim(),
        sellerReplyAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    })

    // Create notification for the reviewer
    await db.notification.create({
      data: {
        userId: review.userId ?? '',
        title: 'Penjual Membalas Review',
        content: `Penjual telah membalas review Anda untuk produk "${review.product?.name ?? 'produk'}"`,
        type: 'system',
        refType: 'review',
        refId: reviewId,
      },
    })

    return NextResponse.json({ success: true, data: updatedReview })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Reviews reply PUT error')
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
