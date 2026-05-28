import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'

import { logger } from '@/lib/logger'
// Helper to safely parse JSON fields
function parseJsonField(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// GET /api/orders/[id] — Get single order detail
export async function GET(
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

    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                slug: true,
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
                value: true,
              },
            },
          },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            storeAvatar: true,
            storeSlug: true,
          },
        },
        shipping: true,
        voucherUsages: {
          include: {
            voucher: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Only buyer or seller can view the order
    const isBuyer = order.userId === user.id
    const seller = await db.seller.findUnique({ where: { userId: user.id } })
    const isSeller = seller !== null && order.sellerId === seller.id

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse product images
    const responseOrder = {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        product: item.product
          ? {
              ...item.product,
              images: parseJsonField(item.product.images),
            }
          : item.product,
      })),
    }

    return NextResponse.json(serializeDecimal(responseOrder))
  } catch (error) {
    logger.error({ err: error }, 'GET /api/orders/[id] error')
    return NextResponse.json(
      { error: 'Gagal mengambil detail pesanan' },
      { status: 500 }
    )
  }
}

// PUT /api/orders/[id]/status — Update order status
export async function PUT(
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
    const { status, trackingNumber } = body as {
      status?: string
      trackingNumber?: string
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      )
    }

    const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const order = await db.order.findUnique({
      where: { id },
      include: { items: true, seller: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check if user is the buyer or the seller
    const isBuyer = order.userId === user.id
    const seller = await db.seller.findUnique({ where: { userId: user.id } })
    const isSeller = seller !== null && order.sellerId === seller.id

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Seller can: mark as processing, shipped (with tracking)
    if (isSeller) {
      if (status === 'processing' && order.status === 'paid') {
        const updated = await db.order.update({
          where: { id },
          data: { status: 'processing' },
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
        return NextResponse.json(updated)
      }

      if (status === 'shipped' && (order.status === 'processing' || order.status === 'paid')) {
        if (!trackingNumber) {
          return NextResponse.json(
            { error: 'Tracking number is required when shipping' },
            { status: 400 }
          )
        }

        const updated = await db.$transaction(async (tx) => {
          const updatedOrder = await tx.order.update({
            where: { id },
            data: {
              status: 'shipped',
              shippedAt: new Date(),
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

          // Update shipping with tracking number
          await tx.shipping.update({
            where: { orderId: id },
            data: {
              trackingNumber,
              status: 'in_transit',
              shippedAt: new Date(),
            },
          })

          return updatedOrder
        })

        return NextResponse.json(updated)
      }
    }

    // Buyer can: confirm received (mark as delivered)
    if (isBuyer && status === 'delivered' && order.status === 'shipped') {
      const updated = await db.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            status: 'delivered',
            deliveredAt: new Date(),
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

        // Update shipping status
        await tx.shipping.update({
          where: { orderId: id },
          data: {
            status: 'delivered',
            deliveredAt: new Date(),
          },
        })

        // Credit seller wallet (subtotal - commission) — use atomic increment to prevent race conditions
        const commissionRate = Number(order.seller.commissionRate)
        const commission = Number(order.subtotal) * commissionRate
        const sellerEarnings = Number(order.subtotal) - commission

        // Ensure seller has a wallet
        let sellerWallet = await tx.wallet.findUnique({
          where: { sellerId: order.sellerId },
        })

        if (!sellerWallet) {
          sellerWallet = await tx.wallet.create({
            data: {
              userId: order.seller.userId,
              sellerId: order.sellerId,
              balance: 0,
              holdBalance: 0,
            },
          })
        }

        // SECURITY: Use atomic increment instead of read-then-write to prevent race conditions
        const updatedWallet = await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: { balance: { increment: sellerEarnings } },
        })

        // Record wallet mutation
        await tx.walletMutation.create({
          data: {
            walletId: sellerWallet.id,
            type: 'credit',
            amount: sellerEarnings,
            balance: Number(updatedWallet.balance),
            description: `Earnings from order ${order.orderNumber}`,
            refType: 'order',
            refId: order.id,
          },
        })

        // Record transaction for seller
        await tx.transaction.create({
          data: {
            userId: order.seller.userId,
            type: 'payment',
            amount: order.subtotal,
            fee: commission,
            netAmount: sellerEarnings,
            method: 'wallet',
            status: 'success',
            description: `Earnings from order ${order.orderNumber}`,
            refId: order.id,
          },
        })

        return updatedOrder
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json(
      { error: `Cannot change status from "${order.status}" to "${status}"` },
      { status: 400 }
    )
  } catch (error) {
    logger.error({ err: error }, 'PUT /api/orders/[id]/status error')
    return NextResponse.json(
      { error: 'Gagal mengubah status pesanan' },
      { status: 500 }
    )
  }
}
