import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { updateOrderStatus } from '@/lib/order-status'

import { parseJsonField } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

// GET /api/orders/[id] — Get single order detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Unified auth using verifyAuth (supports both session and bearer token)
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
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
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // Only buyer, seller, or admin can view the order
    const isBuyer = order.userId === user.id
    const seller = await db.seller.findUnique({ where: { userId: user.id } })
    const isSeller = seller !== null && order.sellerId === seller.id
    const isAdmin = ['admin', 'manager'].includes(user.role)

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
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

    return NextResponse.json({ success: true, data: serializeDecimal(responseOrder) })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/orders/[id] error')
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil detail pesanan' },
      { status: 500 }
    )
  }
}

// PUT /api/orders/[id] — Update order status
// Delegates to the shared updateOrderStatus function for consistent
// state machine validation, escrow handling, stock management, and notifications
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Unified auth using verifyAuth (supports both session and bearer token)
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    const body = await request.json()
    const { status, cancelReason, trackingNumber } = body as {
      status?: string
      cancelReason?: string
      trackingNumber?: string
    }

    // Delegate to shared order status update function
    const result = await updateOrderStatus({
      orderId: id,
      status: status || '',
      cancelReason,
      trackingNumber,
      authUserId: authResult.user.id,
      authUserRole: authResult.user.role,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 400 }
      )
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: result.data,
    }))
  } catch (error) {
    logger.error({ err: error }, 'PUT /api/orders/[id] error')
    return NextResponse.json(
      { success: false, error: 'Gagal mengubah status pesanan' },
      { status: 500 }
    )
  }
}
