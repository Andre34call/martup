import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createRateLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// Rate limiter: 1 product view per IP per minute per product
const productViewLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1, keyPrefix: 'rl:product:view:' })

// POST /api/products/[id]/view - Track product view and update viral score
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Rate limit: 1 view per product per IP per minute
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await productViewLimiter.check(`${clientIp}:${id}`)
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: true, viewed: false })
    }

    const product = await db.product.findUnique({
      where: { id },
      select: { id: true, status: true, sold: true, rating: true, reviewCount: true, viewCount: true },
    })

    if (!product || product.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Increment viewCount and recalculate viral score
    const newViewCount = product.viewCount + 1
    const viralScore = product.sold * 3 + (product.rating || 0) * product.reviewCount * 5 + newViewCount * 0.1

    await db.product.update({
      where: { id },
      data: {
        viewCount: newViewCount,
        viralScore,
      },
    })

    return NextResponse.json({
      success: true,
      viewCount: newViewCount,
      viralScore,
    })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/products/[id]/view error')
    return NextResponse.json(
      { success: false, error: 'Failed to track view' },
      { status: 500 }
    )
  }
}
