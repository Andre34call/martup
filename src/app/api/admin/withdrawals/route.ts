import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'

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

    return NextResponse.json(serializeDecimal({ success: true, data: mapped }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin withdrawals GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/withdrawals - Update withdrawal status (approve, reject, complete)
// SECURITY: Uses $transaction for all status changes to ensure atomic financial operations
// CRITICAL: On rejection, holdBalance MUST be refunded back to balance
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

    // SECURITY: Use $transaction for all status changes involving financial operations
    const withdrawal = await db.$transaction(async (tx) => {
      const updatedWithdrawal = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: updateData,
      })

      // CRITICAL: On rejection, refund holdBalance back to seller's balance
      // Without this, the seller's escrowed funds would be lost permanently
      if (status === 'rejected') {
        const wallet = await tx.wallet.findUnique({
          where: { sellerId: current.sellerId },
        })

        if (wallet) {
          // Move funds back from holdBalance to balance
          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: { increment: current.amount },
              holdBalance: { decrement: current.amount },
            },
          })

          // Record the refund mutation
          await tx.walletMutation.create({
            data: {
              walletId: wallet.id,
              type: 'credit',
              amount: current.amount,
              balance: updatedWallet.balance,
              description: `Pengembalian dana penarikan yang ditolak${adminNote ? `: ${adminNote}` : ''}`,
              refType: 'withdraw',
              refId: current.id,
            },
          })
        }
      }

      // When processing (completing) a withdrawal, reduce holdBalance
      // (funds are now actually sent to the seller's bank account)
      if (status === 'processed') {
        const wallet = await tx.wallet.findUnique({
          where: { sellerId: current.sellerId },
        })

        if (wallet) {
          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              holdBalance: { decrement: current.amount },
            },
          })

          // Record the final deduction from hold
          await tx.walletMutation.create({
            data: {
              walletId: wallet.id,
              type: 'debit',
              amount: current.amount,
              balance: updatedWallet.balance,
              description: `Penarikan dana selesai ke ${current.bankName} - ${current.bankAccount}`,
              refType: 'withdraw',
              refId: current.id,
            },
          })
        }
      }

      // Update the corresponding transaction record status
      if (status === 'rejected') {
        await tx.transaction.updateMany({
          where: { refId: current.id, type: 'withdraw', status: 'pending' },
          data: { status: 'failed' },
        })
      } else if (status === 'processed') {
        await tx.transaction.updateMany({
          where: { refId: current.id, type: 'withdraw', status: 'pending' },
          data: { status: 'success' },
        })
      }

      return updatedWithdrawal
    })

    logBusinessEvent({
      event: 'WITHDRAWAL_STATUS_CHANGED',
      userId: authResult.user.id,
      details: { withdrawalId, newStatus: status, adminNote },
    })

    return NextResponse.json(serializeDecimal({ success: true, data: withdrawal }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin withdrawals PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
