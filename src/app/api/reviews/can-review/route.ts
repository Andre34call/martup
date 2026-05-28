import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// ==================== GET /api/reviews/can-review ====================
// Check if the authenticated user can review a product.
// Returns which order items for the product are still reviewable
// (i.e., belong to a delivered order and have not been reviewed yet).

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const userId = authResult.user.id

    // Extract productId from query parameters
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    // Find all order items for this product that:
    // 1. Belong to the authenticated user's orders
    // 2. The order status is 'delivered'
    // 3. No review exists for the order item yet
    const reviewableOrderItems = await db.orderItem.findMany({
      where: {
        productId,
        order: {
          userId,
          status: 'delivered',
        },
        review: null, // no review has been submitted for this order item
      },
      select: {
        id: true,
        orderId: true,
        productName: true,
      },
    })

    const canReview = reviewableOrderItems.length > 0

    return NextResponse.json({
      success: true,
      canReview,
      reviewableOrderItems: reviewableOrderItems.map((item) => ({
        orderItemId: item.id,
        orderId: item.orderId,
        productName: item.productName,
      })),
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Can-review GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
