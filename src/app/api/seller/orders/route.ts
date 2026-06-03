import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'

import { parseJsonField } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

// GET /api/seller/orders — List orders for the current seller
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Unified auth using verifyAuth (supports both session and bearer token)
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
    }

    // Verify seller account
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
    })
    if (!seller) {
      return NextResponse.json({ success: false, error: 'Seller account required' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl

    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    const where: Record<string, unknown> = {
      sellerId: seller.id,
    }

    if (status) {
      where.status = status
    }

    const skip = (page - 1) * limit

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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
          user: {
            select: {
              id: true,
              name: true,
              // SECURITY FIX: Removed email from select — buyer email addresses
              // should not be exposed to sellers (data privacy risk).
              avatar: true,
            },
          },
          shipping: true,
        },
      }),
      db.order.count({ where }),
    ])

    // Parse product images safely
    const parsedOrders = orders.map((order) => ({
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
    }))

    return NextResponse.json({
      items: parsedOrders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'GET /api/seller/orders error')
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data pesanan seller' },
      { status: 500 }
    )
  }
}
