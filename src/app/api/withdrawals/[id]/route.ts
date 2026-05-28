import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logSecurityEvent, logBusinessEvent } from '@/lib/logger'

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

    const withdrawal = await db.withdrawal.findUnique({ where: { id } })
    if (!withdrawal) {
      return NextResponse.json(
        { success: false, error: 'Penarikan dana tidak ditemukan' },
        { status: 404 }
      )
    }

    // SECURITY: Only allow status changes from 'pending' (prevent double-processing)
    if (withdrawal.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Penarikan sudah berstatus "${withdrawal.status}". Hanya penarikan "pending" yang bisa diproses.` },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { status }
    if (adminNote) updateData.adminNote = adminNote
    if (status === 'approved' || status === 'processed') {
      updateData.processedAt = new Date()
    }

    const updated = await db.$transaction(async (tx) => {
      const updatedWithdrawal = await tx.withdrawal.update({
        where: { id },
        data: updateData,
      })

      // If rejected, refund the amount to seller wallet
      if (status === 'rejected') {
        const wallet = await tx.wallet.findUnique({
          where: { sellerId: withdrawal.sellerId },
        })
        if (wallet) {
          const newBalance = Number(wallet.balance) + Number(withdrawal.amount)
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: withdrawal.amount } },
          })

          await tx.walletMutation.create({
            data: {
              walletId: wallet.id,
              type: 'credit',
              amount: withdrawal.amount,
              balance: newBalance,
              description: `Pengembalian dana penarikan yang ditolak${adminNote ? `: ${adminNote}` : ''}`,
              refType: 'withdraw',
              refId: withdrawal.id,
            },
          })
        }
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
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Update withdrawal error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
