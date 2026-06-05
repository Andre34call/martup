import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'
import { validateBody, adminWithdrawalActionSchema } from '@/lib/validations'
import { validateCsrfRequest } from '@/lib/csrf'

// GET /api/admin/withdrawals - Fetch all withdrawal requests with seller info (paginated)
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // optional filter
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const [withdrawals, total] = await Promise.all([
      db.withdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
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

    return NextResponse.json(serializeDecimal({
      success: true,
      data: mapped,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }))
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

  // SECURITY: CSRF protection
  const csrfResult = await validateCsrfRequest(request)
  if (!csrfResult.valid) {
    return NextResponse.json({ success: false, error: 'Keamanan request tidak valid. Refresh halaman dan coba lagi.' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // SECURITY: Use Zod validation (VULN-8 fix)
    const validation = validateBody(adminWithdrawalActionSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { withdrawalId, status, adminNote } = validation.data

    // SECURITY: Fetch + status check INSIDE transaction to prevent race conditions
    const withdrawal = await db.$transaction(async (tx) => {
      // Fetch withdrawal INSIDE transaction
      const current = await tx.withdrawal.findUnique({
        where: { id: withdrawalId },
      })

      if (!current) {
        throw new Error('NOT_FOUND')
      }

      // SECURITY: Validate status transition INSIDE transaction to prevent double-processing
      const allowedTransitions: Record<string, string[]> = {
        pending: ['approved', 'rejected'],
        approved: ['processed'],
        processed: [], // terminal state
        rejected: [], // terminal state
      }

      const allowed = allowedTransitions[current.status] || []
      if (!allowed.includes(status)) {
        throw new Error(`INVALID_TRANSITION:${current.status}:${status}`)
      }

      const updateData: Record<string, unknown> = { status }
      if (adminNote !== undefined) updateData.adminNote = adminNote

      if (status === 'processed') {
        updateData.processedAt = new Date()
      }

      const updatedWithdrawal = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: updateData,
      })

      // CRITICAL: On rejection, refund holdBalance back to seller's balance
      if (status === 'rejected') {
        // Find seller's userId to locate the unified wallet
        const seller = await tx.seller.findUnique({ where: { id: current.sellerId }, select: { userId: true } })
        const wallet = seller ? await tx.wallet.findUnique({
          where: { userId: seller.userId },
        }) : null

        if (wallet) {
          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: { increment: current.amount },
              holdBalance: { decrement: current.amount },
            },
          })

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
      if (status === 'processed') {
        // Find seller's userId to locate the unified wallet
        const seller = await tx.seller.findUnique({ where: { id: current.sellerId }, select: { userId: true } })
        const wallet = seller ? await tx.wallet.findUnique({
          where: { userId: seller.userId },
        }) : null

        if (wallet) {
          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              holdBalance: { decrement: current.amount },
            },
          })

          // SECURITY: Verify holdBalance didn't go negative
          if (updatedWallet.holdBalance.lessThan(0)) {
            throw new Error('INSUFFICIENT_HOLD_BALANCE')
          }

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
    // Handle transaction-level errors
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: 'Penarikan dana tidak ditemukan' },
          { status: 404 }
        )
      }
      if (error.message.startsWith('INVALID_TRANSITION:')) {
        const parts = error.message.split(':')
        const from = parts[1] || '?'
        const to = parts[2] || '?'
        return NextResponse.json(
          { success: false, error: `Tidak dapat mengubah status dari "${from}" ke "${to}"` },
          { status: 400 }
        )
      }
      if (error.message === 'INSUFFICIENT_HOLD_BALANCE') {
        return NextResponse.json(
          { success: false, error: 'Saldo hold tidak mencukupi. Hubungi teknisi.' },
          { status: 400 }
        )
      }
    }
    logger.error({ err: error }, 'Admin withdrawals PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
