import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { Prisma } from '@prisma/client'

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
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin orders GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/orders - Update order status (admin-protected) with proper business logic
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const { orderId, status, cancelReason, trackingNumber } = body as {
      orderId: string
      status: string
      cancelReason?: string
      trackingNumber?: string
    }

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      )
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'status is required' },
        { status: 400 }
      )
    }

    // Validate status value
    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Status tidak valid. Pilihan: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate cancel reason when status is 'cancelled'
    if (status === 'cancelled') {
      if (!cancelReason || typeof cancelReason !== 'string' || cancelReason.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Alasan pembatalan wajib diisi saat membatalkan pesanan' },
          { status: 400 }
        )
      }
    }

    // Find the order
    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            storeAvatar: true,
            commissionRate: true,
            wallet: true,
          },
        },
        shipping: true,
      },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Validate status transition - admin can only move forward or cancel
    const VALID_TRANSITIONS: Record<string, string[]> = {
      pending: ['paid', 'cancelled'],
      paid: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered', 'cancelled'],
      delivered: [], // No further transitions
      cancelled: [], // No further transitions
    }

    const allowedNextStatuses = VALID_TRANSITIONS[existingOrder.status]
    if (!allowedNextStatuses || !allowedNextStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Tidak dapat mengubah status dari "${existingOrder.status}" ke "${status}". Transisi tidak valid.` },
        { status: 400 }
      )
    }

    // Use the same business logic as /api/orders/[id]/status by forwarding the request
    // This ensures escrow, refunds, stock, and notifications are handled consistently
    const adminToken = request.headers.get('authorization')
    const internalRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { 'Authorization': adminToken } : {}),
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        status,
        ...(cancelReason ? { cancelReason: cancelReason.trim() } : {}),
        ...(trackingNumber ? { trackingNumber: trackingNumber.trim() } : {}),
      }),
    })

    const internalData = await internalRes.json()

    if (!internalRes.ok || !internalData.success) {
      return NextResponse.json(
        { success: false, error: internalData.error || 'Gagal mengubah status pesanan' },
        { status: internalRes.status }
      )
    }

    return NextResponse.json(serializeDecimal({ success: true, data: internalData.data }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin orders PUT error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
