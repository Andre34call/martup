import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'

// ==================== GET /api/payment/status ====================
// Check payment status for an order

export async function GET(request: NextRequest) {
  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 2: Get orderId from query params
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId query parameter is required' },
        { status: 400 }
      )
    }

    // Step 3: Find the order
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        totalAmount: true,
        paidAt: true,
        createdAt: true,
        cancelledAt: true,
        cancelReason: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Step 4: Verify order belongs to the authenticated user
    if (order.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only check payment status for your own orders' },
        { status: 403 }
      )
    }

    // Step 5: Find related transaction record
    const transaction = await db.transaction.findFirst({
      where: {
        type: 'payment',
        refId: order.orderNumber,
      },
      select: {
        id: true,
        status: true,
        method: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Step 6: Return the payment status
    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          totalAmount: order.totalAmount,
          paidAt: order.paidAt,
          createdAt: order.createdAt,
          cancelledAt: order.cancelledAt,
          cancelReason: order.cancelReason,
          transaction: transaction || null,
        },
      })
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Payment Status GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
