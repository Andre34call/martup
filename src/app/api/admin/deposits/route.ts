import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

// GET /api/admin/deposits - List all deposits with user info, support ?status=pending filter
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    const deposits = await db.deposit.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const mapped = deposits.map((d) => ({
      id: d.id,
      userId: d.userId,
      userName: d.user.name,
      userEmail: d.user.email,
      userPhone: d.user.phone,
      userAvatar: d.user.avatar,
      amount: d.amount,
      method: d.method,
      status: d.status,
      proofUrl: d.proofUrl,
      adminNote: d.adminNote,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))

    return NextResponse.json({ success: true, data: mapped })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin deposits GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/deposits - Update deposit status (approve/reject)
// When approving (status='success'), also credit the user's wallet balance
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const { depositId, status, adminNote } = body

    if (!depositId || !status) {
      return NextResponse.json(
        { success: false, error: 'depositId and status are required' },
        { status: 400 }
      )
    }

    if (!['success', 'failed'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'status must be "success" or "failed"' },
        { status: 400 }
      )
    }

    // Fetch the deposit to verify it exists and is currently pending
    const deposit = await db.deposit.findUnique({
      where: { id: depositId },
    })

    if (!deposit) {
      return NextResponse.json(
        { success: false, error: 'Deposit not found' },
        { status: 404 }
      )
    }

    if (deposit.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Deposit already processed with status "${deposit.status}"` },
        { status: 400 }
      )
    }

    // If approving, credit the user's wallet
    if (status === 'success') {
      const wallet = await db.wallet.findUnique({
        where: { userId: deposit.userId },
      })

      if (wallet) {
        await db.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: deposit.amount } },
        })

        await db.walletMutation.create({
          data: {
            walletId: wallet.id,
            type: 'credit',
            amount: deposit.amount,
            balance: wallet.balance + deposit.amount,
            description: `Deposit approved - ${deposit.method}`,
            refType: 'deposit',
            refId: deposit.id,
          },
        })
      } else {
        // Create wallet if it doesn't exist, then credit
        const newWallet = await db.wallet.create({
          data: {
            userId: deposit.userId,
            balance: deposit.amount,
          },
        })

        await db.walletMutation.create({
          data: {
            walletId: newWallet.id,
            type: 'credit',
            amount: deposit.amount,
            balance: newWallet.balance,
            description: `Deposit approved - ${deposit.method}`,
            refType: 'deposit',
            refId: deposit.id,
          },
        })
      }
    }

    // Update deposit status
    const updateData: Record<string, unknown> = { status }
    if (adminNote !== undefined) updateData.adminNote = adminNote

    const updatedDeposit = await db.deposit.update({
      where: { id: depositId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: updatedDeposit })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin deposits PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
