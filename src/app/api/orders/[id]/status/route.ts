import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status, cancelReason } = await request.json()

    if (!status) {
      return NextResponse.json(
        { error: 'Status wajib diisi' },
        { status: 400 }
      )
    }

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = { status }

    if (status === 'paid') {
      updateData.paymentStatus = 'paid'
      updateData.paidAt = new Date()
    } else if (status === 'shipped') {
      updateData.shippedAt = new Date()
    } else if (status === 'delivered') {
      updateData.deliveredAt = new Date()
      // Release escrow to seller's available balance
      const sellerWallet = await db.wallet.findUnique({
        where: { sellerId: order.sellerId },
      })
      if (sellerWallet) {
        const releaseAmount = order.totalAmount * (1 - 0.05) // minus commission
        await db.wallet.update({
          where: { sellerId: order.sellerId },
          data: {
            holdBalance: { decrement: releaseAmount },
            balance: { increment: releaseAmount },
          },
        })

        await db.walletMutation.create({
          data: {
            walletId: sellerWallet.id,
            type: 'credit',
            amount: releaseAmount,
            balance: sellerWallet.balance + releaseAmount,
            description: `Pencairan dana pesanan ${order.orderNumber}`,
            refType: 'order',
            refId: order.id,
          },
        })
      }

      // Update seller total sales
      await db.seller.update({
        where: { id: order.sellerId },
        data: { totalSales: { increment: 1 } },
      })
    } else if (status === 'cancelled') {
      updateData.cancelledAt = new Date()
      updateData.cancelReason = cancelReason || null

      // Restore stock
      for (const item of order.items) {
        await db.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            sold: { decrement: item.quantity },
          },
        })

        if (item.variantId) {
          await db.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          })
        }
      }

      // Refund wallet if paid
      if (order.paymentStatus === 'paid') {
        const buyerWallet = await db.wallet.findUnique({
          where: { userId: order.userId },
        })
        if (buyerWallet) {
          await db.wallet.update({
            where: { userId: order.userId },
            data: { balance: { increment: order.totalAmount } },
          })

          await db.walletMutation.create({
            data: {
              walletId: buyerWallet.id,
              type: 'credit',
              amount: order.totalAmount,
              balance: buyerWallet.balance + order.totalAmount,
              description: `Refund pesanan ${order.orderNumber}`,
              refType: 'refund',
              refId: order.id,
            },
          })
        }

        // Deduct from seller hold balance
        const sellerWallet = await db.wallet.findUnique({
          where: { sellerId: order.sellerId },
        })
        if (sellerWallet) {
          const holdAmount = order.totalAmount * (1 - 0.05)
          await db.wallet.update({
            where: { sellerId: order.sellerId },
            data: { holdBalance: { decrement: holdAmount } },
          })
        }
      }
    }

    const updatedOrder = await db.order.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        shipping: true,
        seller: { select: { id: true, storeName: true } },
      },
    })

    // Create notification for user
    await db.notification.create({
      data: {
        userId: order.userId,
        title: 'Status Pesanan Diperbarui',
        content: `Pesanan ${order.orderNumber} status: ${status}`,
        type: 'order',
        refType: 'order',
        refId: order.id,
      },
    })

    return NextResponse.json({ order: updatedOrder })
  } catch (error) {
    console.error('Update order status error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
