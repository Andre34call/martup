import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/admin/withdrawals - Fetch all withdrawal requests with seller info
export async function GET() {
  try {
    const withdrawals = await db.withdrawal.findMany({
      include: {
        seller: {
          select: { storeName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const mapped = withdrawals.map((w) => ({
      id: w.id,
      sellerId: w.sellerId,
      storeName: w.seller.storeName,
      amount: w.amount,
      bankAccount: w.bankAccount,
      bankName: w.bankName,
      bankHolder: w.bankHolder,
      status: w.status,
      adminNote: w.adminNote,
      processedAt: w.processedAt,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }))

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
  try {
    const body = await request.json()
    const { withdrawalId, status, adminNote } = body

    if (!withdrawalId || !status) {
      return NextResponse.json(
        { success: false, error: 'withdrawalId and status are required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      status,
      processedAt: new Date(),
    }
    if (adminNote !== undefined) updateData.adminNote = adminNote

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
