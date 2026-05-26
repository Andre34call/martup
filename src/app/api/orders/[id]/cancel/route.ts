import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-helpers'

import { logger } from '@/lib/logger'
// POST /api/orders/[id]/cancel — Cancel order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
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

      // If paid with wallet, refund buyer wallet
      if (order.paymentStatus === 'paid' && order.paymentMethod === 'wallet') {
        const buyerWallet = await tx.wallet.findUnique({
          where: { userId: user.id },
        })

        if (buyerWallet) {
          const newBalance = Number(buyerWallet.balance) + Number(order.totalAmount)
          await tx.wallet.update({
            where: { id: buyerWallet.id },
            data: { balance: newBalance },
          })

          // Record wallet mutation
          await tx.walletMutation.create({
            data: {
              walletId: buyerWallet.id,
              type: 'credit',
              amount: order.totalAmount,
              balance: newBalance,
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

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error({ err: error }, 'POST /api/orders/[id]/cancel error')
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
