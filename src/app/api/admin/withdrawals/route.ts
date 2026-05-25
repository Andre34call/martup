import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

// GET /api/admin/withdrawals - Fetch all withdrawal requests with seller info
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // optional filter

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const withdrawals = await db.withdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

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

    const mapped = withdrawals.map((w) => {
      const seller = sellerMap.get(w.sellerId)
      return {
        id: w.id,
        sellerId: w.sellerId,
        storeName: seller?.storeName || seller?.user?.name || 'Unknown Seller',
        sellerName: seller?.storeName || seller?.user?.name || 'Unknown Seller',
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

    return NextResponse.json({ success: true, data: mapped })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin withdrawals GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/withdrawals - Update withdrawal status (approve, reject, complete)
export async function PUT(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { withdrawalId, status, adminNote } = body

    if (!withdrawalId || !status) {
      return NextResponse.json(
        { success: false, error: 'withdrawalId and status are required' },
        { status: 400 }
      )
    }

    // Validate status transitions
    const validStatuses = ['pending', 'approved', 'rejected', 'processed']
    if (!validStatuses.includes(status)) {
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

    const allowedTransitions: Record<string, string[]> = {
      pending: ['approved', 'rejected'],
      approved: ['processed'],
      processed: [], // terminal state
      rejected: [], // terminal state
    }

    const allowed = allowedTransitions[current.status] || []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot transition from "${current.status}" to "${status}". Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`,
        },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { status }
    if (adminNote !== undefined) updateData.adminNote = adminNote

    // When status changes to 'processed', also set processedAt
    if (status === 'processed') {
      updateData.processedAt = new Date()
    }

    const withdrawal = await db.withdrawal.update({
      where: { id: withdrawalId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: withdrawal })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin withdrawals PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
