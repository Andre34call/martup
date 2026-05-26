import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSeller } from '@/lib/auth-helpers'

// GET /api/seller/orders — List orders for the current seller
export async function GET(request: NextRequest) {
  try {
    const { seller } = await requireSeller()
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
              email: true,
              avatar: true,
            },
          },
          shipping: true,
        },
      }),
      db.order.count({ where }),
    ])

    // Parse product images
    const items = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        product: {
          ...item.product,
          images: JSON.parse(item.product.images) as string[],
        },
      })),
    }))

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Seller account required') {
      return NextResponse.json({ error: 'Seller account required' }, { status: 403 })
    }
    console.error('GET /api/seller/orders error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch seller orders' },
      { status: 500 }
    )
  }
}
