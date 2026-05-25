import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

// GET /api/admin/withdrawals - List all withdrawals with seller info
export async function GET(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // optional filter: pending, approved, rejected, processed
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    if (status && status !== 'all') {
      where.status = status
    }

    const [withdrawals, total] = await Promise.all([
      db.withdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.withdrawal.count({ where }),
    ])

    // Fetch seller info for each unique sellerId
    const sellerIds = [...new Set(withdrawals.map((w) => w.sellerId))]

    const sellers = await db.seller.findMany({
      where: { id: { in: sellerIds } },
      select: {
        id: true,
        storeName: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const sellerMap = new Map(sellers.map((s) => [s.id, s]))

    const formattedWithdrawals = withdrawals.map((w) => {
      const seller = sellerMap.get(w.sellerId)
      return {
        id: w.id,
        sellerId: w.sellerId,
        sellerName: seller?.storeName || seller?.user?.name || 'Unknown Seller',
        sellerEmail: seller?.user?.email || '',
        amount: w.amount,
        bankAccount: w.bankAccount,
        bankName: w.bankName,
        bankHolder: w.bankHolder,
        status: w.status,
        adminNote: w.adminNote,
        processedAt: w.processedAt,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }
    })

    return NextResponse.json({
      success: true,
      withdrawals: formattedWithdrawals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin withdrawals GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/withdrawals - Update withdrawal status
export async function PATCH(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { withdrawalId, updates } = body

    if (!withdrawalId) {
      return NextResponse.json(
        { success: false, error: 'withdrawalId is required' },
        { status: 400 }
      )
    }

    if (!updates || !updates.status) {
      return NextResponse.json(
        { success: false, error: 'updates.status is required' },
        { status: 400 }
      )
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'processed']
    if (!validStatuses.includes(updates.status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch current withdrawal to validate status transition
    const current = await db.withdrawal.findUnique({
      where: { id: withdrawalId },
    })

    if (!current) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal not found' },
        { status: 404 }
      )
    }

    // Validate status transitions
    const allowedTransitions: Record<string, string[]> = {
      pending: ['approved', 'rejected'],
      approved: ['processed'],
      processed: [], // terminal state
      rejected: [], // terminal state
    }

    const allowed = allowedTransitions[current.status] || []
    if (!allowed.includes(updates.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot transition from "${current.status}" to "${updates.status}". Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`,
        },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: updates.status,
    }

    if (updates.adminNote !== undefined) {
      updateData.adminNote = updates.adminNote
    }

    // When status changes to 'processed', also set processedAt
    if (updates.status === 'processed') {
      updateData.processedAt = new Date()
    }

    const updated = await db.withdrawal.update({
      where: { id: withdrawalId },
      data: updateData,
    })

    // Fetch seller info for the response
    const seller = await db.seller.findUnique({
      where: { id: updated.sellerId },
      select: {
        id: true,
        storeName: true,
        user: {
          select: { name: true, email: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: updated.id,
        sellerId: updated.sellerId,
        sellerName: seller?.storeName || seller?.user?.name || 'Unknown Seller',
        amount: updated.amount,
        bankAccount: updated.bankAccount,
        bankName: updated.bankName,
        bankHolder: updated.bankHolder,
        status: updated.status,
        adminNote: updated.adminNote,
        processedAt: updated.processedAt,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin withdrawals PATCH error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
