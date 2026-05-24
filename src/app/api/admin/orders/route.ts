import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

// GET /api/admin/orders - Fetch all orders with buyer name for admin
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
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
              variant: true,
            },
          },
          shipping: true,
          seller: {
            select: {
              id: true,
              storeName: true,
              storeSlug: true,
              storeAvatar: true,
              isVerified: true,
              isPremium: true,
              rating: true,
              totalSales: true,
              totalProducts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.order.count({ where }),
    ])

    // Parse JSON fields in order items (product images) and add buyerName
    const parsedOrders = orders.map((order) => ({
      ...order,
      buyerName: order.user?.name || 'Unknown',
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
      success: true,
      data: parsedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin orders GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
