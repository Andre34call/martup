import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'

import { logger } from '@/lib/logger'
// POST /api/orders/[id]/cancel — Cancel order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Unified auth using verifyAuth (supports both session and bearer token)
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const user = authResult.user

    const { id } = await params

    const body = await request.json()
    const { reason } = body as { reason?: string }

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Only buyer can cancel their own order
    if (order.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only if status is "pending" or "paid"
    if (order.status !== 'pending' && order.status !== 'paid') {
      return NextResponse.json(
        { error: 'Order can only be cancelled if status is pending or paid' },
        { status: 400 }
      )
    }

    const updated = await db.$transaction(async (tx) => {
      // Update order status
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: reason ?? 'Cancelled by buyer',
          paymentStatus: order.paymentStatus === 'paid' ? 'refunded' : 'unpaid',
        },
        include: {
          items: true,
          shipping: true,
          seller: {
            select: {
              id: true,
              storeName: true,
              storeAvatar: true,
            },
          },
        },
      })

      // Restore product stock
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          })
        }
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            sold: { decrement: item.quantity },
          },
        })
      }

      // Decrement seller totalSales
      const totalItemsCount = order.items.reduce((sum, i) => sum + i.quantity, 0)
      await tx.seller.update({
        where: { id: order.sellerId },
        data: { totalSales: { decrement: totalItemsCount } },
      })

      // If paid with wallet, refund buyer wallet — use atomic increment
      if (order.paymentStatus === 'paid' && order.paymentMethod === 'wallet') {
        const buyerWallet = await tx.wallet.findUnique({
          where: { userId: user.id },
        })

        if (buyerWallet) {
          // SECURITY: Use atomic increment instead of read-then-write
          const updatedWallet = await tx.wallet.update({
            where: { id: buyerWallet.id },
            data: { balance: { increment: Number(order.totalAmount) } },
          })

          // Record wallet mutation
          await tx.walletMutation.create({
            data: {
              walletId: buyerWallet.id,
              type: 'credit',
              amount: order.totalAmount,
              balance: Number(updatedWallet.balance),
              description: `Refund for cancelled order ${order.orderNumber}`,
              refType: 'refund',
              refId: order.id,
            },
          })

          // Record transaction
          await tx.transaction.create({
            data: {
              userId: user.id,
              type: 'refund',
              amount: order.totalAmount,
              fee: 0,
              netAmount: order.totalAmount,
              method: 'wallet',
              status: 'success',
              description: `Refund for cancelled order ${order.orderNumber}`,
              refId: order.id,
            },
          })
        }
      }

      return updatedOrder
    })

    // SECURITY (SG-5): If order was paid via Midtrans (not wallet), request refund from Midtrans
    if (order.paymentStatus === 'paid' && order.paymentMethod && order.paymentMethod !== 'wallet') {
      try {
        const { requestMidtransRefund } = await import('@/lib/midtrans-server')
        const refundResult = await requestMidtransRefund(
          order.orderNumber,
          Number(order.totalAmount),
          reason || 'Cancelled by buyer'
        )
        if (refundResult.success) {
          logger.info({ orderId: order.id, orderNumber: order.orderNumber }, 'Midtrans refund requested')
        } else {
          logger.warn({ orderId: order.id, orderNumber: order.orderNumber, error: refundResult.message }, 'Midtrans refund failed — manual refund may be needed')
        }
      } catch (refundError) {
        logger.error({ err: refundError, orderId: order.id }, 'Midtrans refund exception')
      }
    }

    return NextResponse.json(updated)
  } catch (error: unknown) {
    logger.error({ err: error }, 'POST /api/orders/[id]/cancel error')
    return NextResponse.json(
      { error: 'Gagal membatalkan pesanan' },
      { status: 500 }
    )
  }
}
