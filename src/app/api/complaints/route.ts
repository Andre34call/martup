import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit } from '@/lib/auth-middleware'
import { sanitizeInput } from '@/lib/sanitize'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

// ==================== GET /api/complaints ====================
// Buyer lists their own complaints
// Supports ?status=open or ?status=resolved filter (comma-separated for multiple)
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') // e.g. "open,processing" or "resolved"

    // Build where clause
    const where: Record<string, unknown> = {
      userId: authResult.user.id,
    }

    if (statusParam) {
      const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        where.status = statuses[0]
      } else if (statuses.length > 1) {
        where.status = { in: statuses }
      }
    }

    const complaints = await db.complaint.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            items: {
              select: {
                productName: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Map to include order details
    const mapped = complaints.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      userId: c.userId,
      type: c.type,
      reason: c.reason,
      description: c.description,
      images: c.images,
      status: c.status,
      resolution: c.resolution,
      refundAmount: c.refundAmount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      order: {
        orderNumber: c.order.orderNumber,
        totalAmount: c.order.totalAmount,
        items: c.order.items,
      },
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: mapped,
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Complaints GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== POST /api/complaints ====================
// Buyer creates a new complaint
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // SECURITY: Rate limit complaint creation (max 5 per minute)
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(`complaint-create:${authResult.user.id}:${clientIp}`, 5)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { orderId, type, reason, description, images } = body

    // Validate required fields
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId wajib diisi' },
        { status: 400 }
      )
    }

    if (!type || !['refund', 'return', 'complain'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'type wajib diisi dan harus salah satu dari: refund, return, complain' },
        { status: 400 }
      )
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'reason wajib diisi' },
        { status: 400 }
      )
    }

    // SECURITY: Sanitize user-generated content
    const sanitizedReason = sanitizeInput(reason.trim())
    const sanitizedDescription = description ? sanitizeInput(description.trim()) : null

    // Check that the order belongs to the authenticated user
    const order = await db.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    if (order.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke pesanan ini' },
        { status: 403 }
      )
    }

    // Only allow complaints on delivered or paid orders
    if (!['delivered', 'paid', 'processing', 'shipped'].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: 'Pengajuan komplain hanya bisa dilakukan untuk pesanan yang sudah dibayar atau diterima' },
        { status: 400 }
      )
    }

    // Check that the order doesn't already have a complaint
    const existingComplaint = await db.complaint.findUnique({
      where: { orderId },
    })

    if (existingComplaint) {
      return NextResponse.json(
        { success: false, error: 'Pesanan ini sudah memiliki pengajuan komplain' },
        { status: 409 }
      )
    }

    // Stringify images array if provided
    const imagesData = images && Array.isArray(images) && images.length > 0
      ? JSON.stringify(images)
      : null

    // Create the complaint
    const complaint = await db.complaint.create({
      data: {
        orderId,
        userId: authResult.user.id,
        type,
        reason: sanitizedReason,
        description: sanitizedDescription,
        images: imagesData,
        status: 'open',
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            items: {
              select: {
                productName: true,
                image: true,
              },
            },
          },
        },
      },
    })

    // Map for response
    const mapped = {
      id: complaint.id,
      orderId: complaint.orderId,
      userId: complaint.userId,
      type: complaint.type,
      reason: complaint.reason,
      description: complaint.description,
      images: complaint.images,
      status: complaint.status,
      resolution: complaint.resolution,
      refundAmount: complaint.refundAmount,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      order: {
        orderNumber: complaint.order.orderNumber,
        totalAmount: complaint.order.totalAmount,
        items: complaint.order.items,
      },
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: mapped,
    }), { status: 201 })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Complaints POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
