import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'
import { validateBody, adminDepositActionSchema } from '@/lib/validations'

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
      amount: Number(d.amount),
      method: d.method,
      status: d.status,
      proofUrl: d.proofUrl,
      adminNote: d.adminNote,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))

    return NextResponse.json(serializeDecimal({ success: true, data: mapped }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin deposits GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/deposits - Update deposit status (approve/reject)
// When approving (status='success'), credits the user's wallet balance ATOMICALLY
// SECURITY: Entire operation is wrapped in a $transaction to prevent race conditions
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const validation = validateBody(adminDepositActionSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { depositId, status, adminNote } = validation.data

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

    // SECURITY: Use $transaction for atomic deposit approval + wallet credit
    // This prevents race conditions where balance could be read incorrectly between operations
    const updatedDeposit = await db.$transaction(async (tx) => {
      // If approving, credit the user's wallet atomically
      if (status === 'success') {
        const wallet = await tx.wallet.findUnique({
          where: { userId: deposit.userId },
        })

        if (wallet) {
          // Atomic increment + read fresh balance within the same transaction
          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: deposit.amount } },
          })

          await tx.walletMutation.create({
            data: {
              walletId: wallet.id,
              type: 'credit',
              amount: deposit.amount,
              balance: updatedWallet.balance,
              description: `Deposit approved - ${deposit.method}`,
              refType: 'deposit',
              refId: deposit.id,
            },
          })
        } else {
          // Create wallet if it doesn't exist, then credit
          const newWallet = await tx.wallet.create({
            data: {
              userId: deposit.userId,
              balance: deposit.amount,
            },
          })

          await tx.walletMutation.create({
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

        // Update corresponding transaction record to 'success'
        await tx.transaction.updateMany({
          where: { refId: deposit.id, type: 'deposit', status: 'pending' },
          data: { status: 'success' },
        })
      }

      // If rejecting, update transaction to 'failed'
      if (status === 'failed') {
        await tx.transaction.updateMany({
          where: { refId: deposit.id, type: 'deposit', status: 'pending' },
          data: { status: 'failed' },
        })
      }

      // Update deposit status
      const updateData: Record<string, unknown> = { status }
      if (adminNote !== undefined) updateData.adminNote = adminNote

      return tx.deposit.update({
        where: { id: depositId },
        data: updateData,
      })
    })

    logBusinessEvent({
      event: 'DEPOSIT_STATUS_CHANGED',
      userId: authResult.user.id,
      details: { depositId, newStatus: status, adminNote },
    })

    return NextResponse.json(serializeDecimal({ success: true, data: updatedDeposit }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin deposits PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
