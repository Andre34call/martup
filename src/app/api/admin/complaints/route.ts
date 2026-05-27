import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { sanitizeInput } from '@/lib/sanitize'
import { serializeDecimal } from '@/lib/decimal-utils'
import { createWorkItemFromEntity } from '@/lib/workflow'

import { logger } from '@/lib/logger'
// GET /api/admin/complaints - Fetch all complaints with order and user info
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // optional filter: open, processing, resolved, rejected
    const type = searchParams.get('type') // optional filter: refund, return, complain

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') where.status = status
    if (type && type !== 'all') where.type = type

    const complaints = await db.complaint.findMany({
      where,
      include: {
        order: {
          include: {
            user: { select: { name: true } },
            seller: { select: { storeName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const mapped = complaints.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.order.user.name,
      type: c.type,
      description: c.description,
      status: c.status,
      createdAt: c.createdAt,
      orderId: c.order.orderNumber,
      orderTotal: c.order.totalAmount,
      buyer: c.order.user.name,
      seller: c.order.seller.storeName,
      reason: c.reason,
      resolution: c.resolution,
      refundAmount: c.refundAmount,
      images: c.images,
    }))

    return NextResponse.json(serializeDecimal({ success: true, data: mapped }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin complaints GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/complaints - Update complaint status (process, resolve, reject)
export async function PUT(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { complaintId, status, refundAmount } = body

    // SECURITY: Sanitize user-generated text fields
    const resolution = body.resolution !== undefined ? sanitizeInput(body.resolution) : undefined

    if (!complaintId || !status) {
      return NextResponse.json(
        { success: false, error: 'complaintId and status are required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { status }
    if (resolution !== undefined) updateData.resolution = resolution
    if (refundAmount !== undefined) updateData.refundAmount = refundAmount

    const complaint = await db.complaint.update({
      where: { id: complaintId },
      data: updateData,
    })

    // Auto-create work item for CS division when complaint is opened
    if (status === 'open' || status === 'processing') {
      const complaintFull = await db.complaint.findUnique({
        where: { id: complaintId },
        include: { order: { include: { user: { select: { name: true } }, seller: { select: { storeName: true } } } } },
      })
      if (complaintFull) {
        await createWorkItemFromEntity({
          type: 'complaint',
          title: `Keluhan: ${complaintFull.order?.user?.name || 'Unknown'} - ${complaintFull.type}`,
          description: `Keluhan ${complaintFull.type} dari ${complaintFull.order?.user?.name || 'Unknown'} terhadap ${complaintFull.order?.seller?.storeName || 'Unknown'}. ${complaintFull.reason || ''}`,
          refType: 'complaint',
          refId: complaintId,
          metadata: { type: complaintFull.type, orderId: complaintFull.orderId, priority: complaintFull.type === 'refund' ? 'high' : 'normal' },
          priority: complaintFull.type === 'refund' ? 'high' : 'normal',
          createdBy: authResult.user.id,
        }).catch(err => logger.warn({ err }, 'Failed to auto-create complaint work item'))
      }
    }

    return NextResponse.json(serializeDecimal({ success: true, data: complaint }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin complaints PUT error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
