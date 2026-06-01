import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit } from '@/lib/auth-middleware'

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

    // SECURITY: Rate limit order cancellations to 5 requests per minute per user
    if (!checkRateLimit(`order-cancel:${user.id}`, 5)) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan pembatalan. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    const { id } = await params

    const body = await request.json()
    const { reason } = body as { reason?: string }

    const updated = await db.$transaction(async (tx) => {
      // BUG 6 FIX: Re-fetch order WITHIN transaction to get latest state
      // This prevents race conditions where two concurrent cancel requests
      // both pass the status check before either updates the DB
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      })

      if (!order) {
        throw new Error('Order not found')
      }

      // Only buyer can cancel their own order
      if (order.userId !== user.id) {
        throw new Error('Forbidden')
      }

      // Only if status is "pending" or "paid" — re-checked inside transaction
      if (order.status !== 'pending' && order.status !== 'paid') {
        throw new Error('Order can only be cancelled if status is pending or paid')
      }

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

      // BUG 7 FIX: Decrement seller's pendingBalance when a paid order is cancelled
      // Regardless of payment method, the seller's pendingBalance was credited during
      // payment and must be reversed on cancellation
      if (order.paymentStatus === 'paid') {
        const sellerWallet = await tx.wallet.findFirst({ where: { sellerId: order.sellerId } })
        if (sellerWallet && Number(sellerWallet.pendingBalance) > 0) {
          const decrementAmount = Math.min(Number(order.totalAmount), Number(sellerWallet.pendingBalance))
          await tx.wallet.update({
            where: { id: sellerWallet.id },
            data: { pendingBalance: { decrement: decrementAmount } },
          })
        }
      }

      // BUG 9 FIX: Only refund to buyer's wallet when paymentMethod === 'wallet'
      // For other payment methods (Midtrans), only the Midtrans refund is requested
      // (handled outside the transaction below) — NOT both wallet credit AND Midtrans refund
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
    // BUG 9 FIX: This only runs for non-wallet payment methods — wallet refunds are handled above
    if (updated.paymentStatus === 'refunded' && updated.paymentMethod && updated.paymentMethod !== 'wallet') {
      try {
        const { requestMidtransRefund } = await import('@/lib/midtrans-server')
        const refundResult = await requestMidtransRefund(
          updated.orderNumber,
          Number(updated.totalAmount),
          reason || 'Cancelled by buyer'
        )
        if (refundResult.success) {
          logger.info({ orderId: updated.id, orderNumber: updated.orderNumber }, 'Midtrans refund requested')
        } else {
          logger.warn({ orderId: updated.id, orderNumber: updated.orderNumber, error: refundResult.message }, 'Midtrans refund failed — manual refund may be needed')
        }
      } catch (refundError) {
        logger.error({ err: refundError, orderId: updated.id }, 'Midtrans refund exception')
      }
    }

    return NextResponse.json(updated)
  } catch (error: unknown) {
    // Handle known business logic errors from the transaction
    if (error instanceof Error) {
      if (error.message === 'Order not found') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (error.message === 'Order can only be cancelled if status is pending or paid') {
        return NextResponse.json(
          { error: 'Order can only be cancelled if status is pending or paid' },
          { status: 400 }
        )
      }
    }
    logger.error({ err: error }, 'POST /api/orders/[id]/cancel error')
    return NextResponse.json(
      { error: 'Gagal membatalkan pesanan' },
      { status: 500 }
    )
  }
}
