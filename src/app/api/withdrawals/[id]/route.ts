import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logSecurityEvent, logBusinessEvent } from '@/lib/logger'
import { validateCsrfRequest } from '@/lib/csrf'

// ==================== WITHDRAWAL APPROVAL/REJECTION ====================
// SECURITY: Only admins can approve/reject withdrawals
// This is the ONLY way to change withdrawal status — prevents auto-approve

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Require admin authentication
    const authResult = await verifyAdmin(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: CSRF protection
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json({ success: false, error: 'Keamanan request tidak valid. Refresh halaman dan coba lagi.' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, adminNote } = body as { status?: string; adminNote?: string }

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status wajib diisi' },
        { status: 400 }
      )
    }

    // Only allow valid status transitions
    const validStatuses = ['approved', 'rejected', 'processed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Status tidak valid. Gunakan: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // SECURITY: Entire operation including status check is inside $transaction to prevent race conditions
    const updated = await db.$transaction(async (tx) => {
      // Fetch withdrawal INSIDE transaction with lock
      const withdrawal = await tx.withdrawal.findUnique({
        where: { id },
      })

      if (!withdrawal) {
        throw new Error('NOT_FOUND')
      }

      // SECURITY: Validate status transition INSIDE transaction to prevent invalid state changes
      const allowedTransitions: Record<string, string[]> = {
        pending: ['approved', 'rejected'],
        approved: ['processed'],
        processed: [], // terminal state
        rejected: [], // terminal state
      }

      const allowed = allowedTransitions[withdrawal.status] || []
      if (!allowed.includes(status)) {
        throw new Error(`INVALID_TRANSITION:${withdrawal.status}:${status}`)
      }

      const updateData: Record<string, unknown> = { status }
      if (adminNote) updateData.adminNote = adminNote
      if (status === 'processed') {
        updateData.processedAt = new Date()
      }

      const updatedWithdrawal = await tx.withdrawal.update({
        where: { id },
        data: updateData,
      })

      // If rejected, refund the amount from holdBalance back to balance
      if (status === 'rejected') {
        // Find seller's userId to locate the unified wallet
        const sellerRecord = await tx.seller.findUnique({ where: { id: withdrawal.sellerId }, select: { userId: true } })
        const wallet = sellerRecord ? await tx.wallet.findUnique({
          where: { userId: sellerRecord.userId },
        }) : null
        if (wallet) {
          // SECURITY: Decrement holdBalance AND increment balance to prevent phantom funds
          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: { increment: withdrawal.amount },
              holdBalance: { decrement: withdrawal.amount },
            },
          })

          await tx.walletMutation.create({
            data: {
              walletId: wallet.id,
              type: 'credit',
              amount: withdrawal.amount,
              balance: updatedWallet.balance,
              description: `Pengembalian dana penarikan yang ditolak${adminNote ? `: ${adminNote}` : ''}`,
              refType: 'withdraw',
              refId: withdrawal.id,
            },
          })
        }
      }

      // When processing (completing) a withdrawal, reduce holdBalance
      if (status === 'processed') {
        // Find seller's userId to locate the unified wallet
        const sellerRecord = await tx.seller.findUnique({ where: { id: withdrawal.sellerId }, select: { userId: true } })
        const wallet = sellerRecord ? await tx.wallet.findUnique({
          where: { userId: sellerRecord.userId },
        }) : null
        if (wallet) {
          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              holdBalance: { decrement: withdrawal.amount },
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
              amount: withdrawal.amount,
              balance: updatedWallet.balance,
              description: `Penarikan dana selesai ke ${withdrawal.bankName} - ${withdrawal.bankAccount}`,
              refType: 'withdraw',
              refId: withdrawal.id,
            },
          })
        }
      }

      // Update the corresponding transaction record status
      if (status === 'rejected') {
        await tx.transaction.updateMany({
          where: { refId: withdrawal.id, type: 'withdraw', status: 'pending' },
          data: { status: 'failed' },
        })
      } else if (status === 'processed') {
        await tx.transaction.updateMany({
          where: { refId: withdrawal.id, type: 'withdraw', status: 'pending' },
          data: { status: 'success' },
        })
      }

      return updatedWithdrawal
    })

    logBusinessEvent({
      event: 'WITHDRAWAL_STATUS_CHANGED',
      userId: authResult.user.id,
      details: { withdrawalId: id, newStatus: status, adminNote },
    })

    return NextResponse.json(serializeDecimal({
      success: true,
      data: updated,
    }))
  } catch (error: unknown) {
    // Handle transaction-level errors (NOT_FOUND, ALREADY_PROCESSED)
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: 'Penarikan dana tidak ditemukan' },
          { status: 404 }
        )
      }
      if (error.message.startsWith('ALREADY_PROCESSED:')) {
        const currentStatus = error.message.split(':')[1]
        return NextResponse.json(
          { success: false, error: `Penarikan sudah berstatus "${currentStatus}".` },
          { status: 400 }
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
    logger.error({ err: error }, 'Update withdrawal error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
