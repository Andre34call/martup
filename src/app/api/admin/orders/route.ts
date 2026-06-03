import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { updateOrderStatus } from '@/lib/order-status'
import { parseJsonField } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// GET /api/admin/orders - Fetch all orders with buyer name for admin
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

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

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Admin orders GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/orders - Update order status (admin-protected)
// Uses the shared updateOrderStatus utility instead of self-fetching via HTTP
// to avoid SSRF risk, serverless cold-start fragility, and CSRF token consumption.

const adminOrderUpdateSchema = z.object({
  orderId: z.string().min(1, 'Order ID wajib diisi'),
  status: z.enum(['processing', 'shipped', 'delivered', 'cancelled', 'paid'], {
    errorMap: () => ({ message: 'Status tidak valid. Pilihan: processing, shipped, delivered, cancelled, paid' }),
  }),
  cancelReason: z.string().optional(),
  trackingNumber: z.string().optional(),
})

export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const validation = adminOrderUpdateSchema.safeParse(body)
    if (!validation.success) {
      const firstError = validation.error.errors[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Input tidak valid' },
        { status: 400 }
      )
    }
    const { orderId, status, cancelReason, trackingNumber } = validation.data

    // Delegate to shared business logic (includes validation, authorization,
    // status transitions, escrow, stock restoration, refunds, notifications)
    const result = await updateOrderStatus({
      orderId,
      status,
      cancelReason,
      trackingNumber,
      authUserId: authResult.user.id,
      authUserRole: authResult.user.role,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 500 }
      )
    }

    return NextResponse.json(serializeDecimal({ success: true, data: result.data }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Admin orders PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
