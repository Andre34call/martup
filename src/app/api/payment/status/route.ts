import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { checkDuitkuTransactionStatus, isDuitkuConfigured } from '@/lib/duitku'
import { processOrderPaymentResult } from '@/lib/duitku-webhook'

import { logger } from '@/lib/logger'
// ==================== GET /api/payment/status ====================
// Check payment status for an order.
// Optional: ?sync=true → poll Duitku transaction status and update the local
// order state if Duitku reports the payment as settled (or failed).
// The webhook (/api/payment/callback) remains the primary source of truth —
// sync is a fallback for missed callbacks. Do NOT poll aggressively.

interface StoredInvoiceRef {
  merchantOrderId: string
  reference: string
  paymentUrl: string
  createdAt: string
}

export async function GET(request: NextRequest) {
  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 2: Get orderId and sync flag from query params
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const sync = searchParams.get('sync') === 'true'

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
        paymentReference: true,
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

    // Step 5: Optionally sync with Duitku (only when the order is still unpaid)
    let duitkuSync: { attempted: boolean; statusCode?: string; message?: string } = { attempted: false }
    const stillUnpaid = order.status === 'pending' && (order.paymentStatus === 'unpaid' || order.paymentStatus === 'pending')

    if (sync && stillUnpaid && isDuitkuConfigured() && order.paymentMethod === 'duitku') {
      // Resolve the merchantOrderId used for the latest invoice (may have a -Rn retry suffix)
      let merchantOrderId = order.orderNumber
      try {
        if (order.paymentReference) {
          const parsed = JSON.parse(order.paymentReference) as Partial<StoredInvoiceRef>
          if (parsed.merchantOrderId) merchantOrderId = parsed.merchantOrderId
        }
      } catch {
        // paymentReference not JSON — use orderNumber
      }

      const statusResult = await checkDuitkuTransactionStatus(merchantOrderId)
      duitkuSync = {
        attempted: true,
        statusCode: statusResult.statusCode,
        message: statusResult.statusMessage,
      }

      if (statusResult.success && statusResult.statusCode === '00') {
        // Duitku confirms the payment is settled — process it (idempotent)
        await processOrderPaymentResult(order.orderNumber, {
          resultCode: '00',
          reference: statusResult.reference,
          paymentCode: statusResult.paymentCode,
          merchantOrderId,
        })
        logger.info({ orderNumber: order.orderNumber }, 'Payment synced from Duitku: PAID')
      } else if (statusResult.success && statusResult.statusCode === '02') {
        await processOrderPaymentResult(order.orderNumber, {
          resultCode: '02',
          reference: statusResult.reference,
          paymentCode: statusResult.paymentCode,
          merchantOrderId,
        })
        logger.info({ orderNumber: order.orderNumber }, 'Payment synced from Duitku: FAILED')
      }
    }

    // Step 6: Re-read the order (may have been updated by sync)
    const freshOrder = await db.order.findUnique({
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

    if (!freshOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Step 7: Find related transaction record
    const transaction = await db.transaction.findFirst({
      where: {
        type: 'payment',
        refId: freshOrder.orderNumber,
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

    // Step 8: Return the payment status
    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: {
          orderId: freshOrder.id,
          orderNumber: freshOrder.orderNumber,
          orderStatus: freshOrder.status,
          paymentStatus: freshOrder.paymentStatus,
          paymentMethod: freshOrder.paymentMethod,
          totalAmount: freshOrder.totalAmount,
          paidAt: freshOrder.paidAt,
          createdAt: freshOrder.createdAt,
          cancelledAt: freshOrder.cancelledAt,
          cancelReason: freshOrder.cancelReason,
          transaction: transaction || null,
          duitkuSync: duitkuSync.attempted ? duitkuSync : undefined,
        },
      })
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'Payment Status GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
