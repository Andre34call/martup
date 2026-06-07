import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { sanitizeInput } from '@/lib/sanitize'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

// ==================== GET /api/complaints/[id] ====================
// Get single complaint detail (buyer-facing)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuth(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { id } = await params

    const complaint = await db.complaint.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: { select: { productName: true, image: true, price: true, quantity: true, subtotal: true } },
            seller: { select: { storeName: true } },
            shipping: { select: { provider: true, service: true, trackingNumber: true, status: true } },
          },
        },
      },
    })

    if (!complaint) {
      return NextResponse.json(
        { success: false, error: 'Komplain tidak ditemukan' },
        { status: 404 }
      )
    }

    // Ensure the complaint belongs to the authenticated user (or admin)
    const isOwner = complaint.userId === authResult.user.id
    const isAdmin = ['admin', 'manager', 'cs'].includes(authResult.user.role)
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke komplain ini' },
        { status: 403 }
      )
    }

    const mapped = {
      id: complaint.id,
      orderId: complaint.orderId,
      orderNumber: complaint.order.orderNumber,
      type: complaint.type,
      reason: complaint.reason,
      description: complaint.description,
      images: complaint.images,
      status: complaint.status,
      resolution: complaint.resolution,
      refundAmount: complaint.refundAmount,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      orderItems: complaint.order.items,
      sellerName: complaint.order.seller?.storeName || null,
      orderTotal: complaint.order.totalAmount,
      shipping: complaint.order.shipping,
    }

    return NextResponse.json(serializeDecimal({ success: true, data: mapped }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Complaint GET [id] error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== PUT /api/complaints/[id] ====================
// Update complaint — buyer can cancel, add messages, or add evidence
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuth(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { id } = await params
    const body = await request.json()
    const { action, message, images } = body

    const complaint = await db.complaint.findUnique({
      where: { id },
    })

    if (!complaint) {
      return NextResponse.json(
        { success: false, error: 'Komplain tidak ditemukan' },
        { status: 404 }
      )
    }

    // Ensure the complaint belongs to the authenticated user
    if (complaint.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke komplain ini' },
        { status: 403 }
      )
    }

    // ---- Action: Cancel complaint ----
    if (action === 'cancel') {
      // Can only cancel if status is 'open' (not yet processed by admin)
      if (complaint.status !== 'open') {
        return NextResponse.json(
          { success: false, error: 'Komplain hanya bisa dibatalkan jika masih berstatus "Terbuka"' },
          { status: 400 }
        )
      }

      const updated = await db.complaint.update({
        where: { id },
        data: { status: 'cancelled' },
        include: {
          order: {
            include: {
              items: { select: { productName: true } },
              seller: { select: { storeName: true } },
            },
          },
        },
      })

      return NextResponse.json(serializeDecimal({
        success: true,
        data: {
          id: updated.id,
          orderId: updated.orderId,
          orderNumber: updated.order.orderNumber,
          type: updated.type,
          reason: updated.reason,
          description: updated.description,
          images: updated.images,
          status: updated.status,
          resolution: updated.resolution,
          refundAmount: updated.refundAmount,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          orderItems: updated.order.items.map(i => i.productName),
          sellerName: updated.order.seller?.storeName || null,
        },
      }))
    }

    // ---- Default action: add messages/evidence to ongoing complaints ----
    // Can only update if complaint is still active (open or processing)
    if (!['open', 'processing'].includes(complaint.status)) {
      return NextResponse.json(
        { success: false, error: 'Komplain ini sudah ditutup dan tidak dapat diubah' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}

    // Add message to description (append)
    if (message && typeof message === 'string') {
      const sanitizedMessage = sanitizeInput(message)
      if (sanitizedMessage.length > 0) {
        const existingDesc = complaint.description || ''
        const separator = existingDesc ? '\n\n---\n\n' : ''
        updateData.description = existingDesc + separator + `[${new Date().toLocaleString('id-ID')}] ${sanitizedMessage}`
      }
    }

    // Add new evidence images — validate URLs (HTTPS only, max 2000 chars each)
    if (Array.isArray(images) && images.length > 0) {
      const newImages = images.filter((url: string) => typeof url === 'string' && url.startsWith('https://') && url.length <= 2000).slice(0, 4)
      if (newImages.length > 0) {
        const existingImages: string[] = complaint.images ? JSON.parse(complaint.images) : []
        const combinedImages = [...existingImages, ...newImages].slice(0, 8) // Max 8 total
        updateData.images = JSON.stringify(combinedImages)
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada data untuk diperbarui' },
        { status: 400 }
      )
    }

    const updated = await db.complaint.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          include: {
            items: { select: { productName: true } },
            seller: { select: { storeName: true } },
          },
        },
      },
    })

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        id: updated.id,
        orderId: updated.orderId,
        orderNumber: updated.order.orderNumber,
        type: updated.type,
        reason: updated.reason,
        description: updated.description,
        images: updated.images,
        status: updated.status,
        resolution: updated.resolution,
        refundAmount: updated.refundAmount,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        orderItems: updated.order.items.map(i => i.productName),
        sellerName: updated.order.seller?.storeName || null,
      },
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Complaint PUT [id] error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
