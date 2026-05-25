import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

// GET /api/admin/complaints - List all complaints with order/user info
export async function GET(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // optional filter: open, processing, resolved, rejected
    const type = searchParams.get('type') // optional filter: refund, return, complain
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    if (status && status !== 'all') {
      where.status = status
    }

    if (type && type !== 'all') {
      where.type = type
    }

    const [complaints, total] = await Promise.all([
      db.complaint.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              totalAmount: true,
              paymentStatus: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              },
              seller: {
                select: {
                  id: true,
                  storeName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.complaint.count({ where }),
    ])

    const formattedComplaints = complaints.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      orderNumber: c.order?.orderNumber || '',
      orderStatus: c.order?.status || '',
      orderTotal: c.order?.totalAmount || 0,
      paymentStatus: c.order?.paymentStatus || '',
      userId: c.userId,
      userName: c.order?.user?.name || 'Unknown User',
      userEmail: c.order?.user?.email || '',
      userAvatar: c.order?.user?.avatar || null,
      sellerId: c.order?.seller?.id || '',
      sellerName: c.order?.seller?.storeName || 'Unknown Seller',
      type: c.type,
      reason: c.reason,
      description: c.description,
      images: c.images,
      status: c.status,
      resolution: c.resolution,
      refundAmount: c.refundAmount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      complaints: formattedComplaints,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin complaints GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/complaints - Update a complaint
export async function PATCH(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { complaintId, updates } = body

    if (!complaintId) {
      return NextResponse.json(
        { success: false, error: 'complaintId is required' },
        { status: 400 }
      )
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'updates object is required with at least one field' },
        { status: 400 }
      )
    }

    // Validate status if provided
    if (updates.status) {
      const validStatuses = ['open', 'processing', 'resolved', 'rejected']
      if (!validStatuses.includes(updates.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate refundAmount if provided
    if (updates.refundAmount !== undefined && updates.refundAmount !== null) {
      const amount = parseFloat(updates.refundAmount)
      if (isNaN(amount) || amount < 0) {
        return NextResponse.json(
          { success: false, error: 'refundAmount must be a valid non-negative number' },
          { status: 400 }
        )
      }
    }

    const allowedFields = ['status', 'resolution', 'refundAmount']
    const filteredUpdates: Record<string, unknown> = {}

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key]
      }
    }

    const complaint = await db.complaint.update({
      where: { id: complaintId },
      data: filteredUpdates,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            paymentStatus: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
            seller: {
              select: {
                id: true,
                storeName: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      complaint: {
        id: complaint.id,
        orderId: complaint.orderId,
        orderNumber: complaint.order?.orderNumber || '',
        orderStatus: complaint.order?.status || '',
        orderTotal: complaint.order?.totalAmount || 0,
        paymentStatus: complaint.order?.paymentStatus || '',
        userId: complaint.userId,
        userName: complaint.order?.user?.name || 'Unknown User',
        userEmail: complaint.order?.user?.email || '',
        userAvatar: complaint.order?.user?.avatar || null,
        sellerId: complaint.order?.seller?.id || '',
        sellerName: complaint.order?.seller?.storeName || 'Unknown Seller',
        type: complaint.type,
        reason: complaint.reason,
        description: complaint.description,
        images: complaint.images,
        status: complaint.status,
        resolution: complaint.resolution,
        refundAmount: complaint.refundAmount,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin complaints PATCH error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
