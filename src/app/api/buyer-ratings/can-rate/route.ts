import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// ==================== GET /api/buyer-ratings/can-rate ====================
// Check if a seller can rate a buyer for specific orders
// Returns list of rateable orders (delivered, not yet rated)
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

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

    // Find delivered orders without buyer rating
    const rateableOrders = await db.order.findMany({
      where: {
        sellerId: seller.id,
        status: 'delivered',
        buyerRating: null,
      },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        deliveredAt: true,
        totalAmount: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            image: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            buyerRating: true,
            buyerRatingCount: true,
          },
        },
      },
      orderBy: { deliveredAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      success: true,
      data: rateableOrders.map(order => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        deliveredAt: order.deliveredAt,
        totalAmount: Number(order.totalAmount),
        items: order.items,
        buyer: order.user,
      })),
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Buyer ratings can-rate GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
