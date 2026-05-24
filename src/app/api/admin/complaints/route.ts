import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/complaints - Fetch all complaints with order and user info
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const complaints = await db.complaint.findMany({
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
      buyer: c.order.user.name,
      seller: c.order.seller.storeName,
      reason: c.reason,
      resolution: c.resolution,
      refundAmount: c.refundAmount,
    }))

    return NextResponse.json({ success: true, data: mapped })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin complaints GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/complaints - Update complaint status (process, resolve, reject)
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { complaintId, status, resolution, refundAmount } = body

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

    return NextResponse.json({ success: true, data: complaint })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin complaints PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
