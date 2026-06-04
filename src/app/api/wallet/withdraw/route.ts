import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'
import { createWorkItemFromEntity } from '@/lib/workflow'
import { z } from 'zod'

// ==================== WALLET WITHDRAW ====================
// SECURITY: Requires authentication + seller verification
// Creates a PENDING withdrawal — MUST be approved by admin
// Balance is moved to holdBalance (escrow) until admin approves/rejects
// Rejection refunds the holdBalance back to balance

const withdrawSchema = z.object({
  amount: z.number().positive('Jumlah penarikan harus lebih dari 0'),
  bankAccount: z.string().min(5, 'Nomor rekening minimal 5 karakter').max(30, 'Nomor rekening maksimal 30 karakter').trim(),
  bankName: z.string().min(2, 'Nama bank minimal 2 karakter').max(50, 'Nama bank maksimal 50 karakter').trim(),
  bankHolder: z.string().min(2, 'Nama pemilik rekening minimal 2 karakter').max(100, 'Nama pemilik rekening maksimal 100 karakter').trim().transform(v => v.replace(/[<>"'&]/g, '')),
})

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Simple rate limit — 3 withdrawal requests per minute per user
    const rateLimitKey = `withdraw:${authResult.user.id}`
    const now = Date.now()
    const rateLimitMap = (globalThis as Record<string, unknown>).__withdrawRateLimit as Map<string, { count: number; resetAt: number }> | undefined
    const rlMap = rateLimitMap || new Map<string, { count: number; resetAt: number }>()
    ;(globalThis as Record<string, unknown>).__withdrawRateLimit = rlMap
    const rlEntry = rlMap.get(rateLimitKey)
    if (rlEntry && rlEntry.resetAt > now) {
      if (rlEntry.count >= 3) {
        return NextResponse.json(
          { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
          { status: 429 }
        )
      }
      rlEntry.count++
    } else {
      rlMap.set(rateLimitKey, { count: 1, resetAt: now + 60_000 })
    }

    // Verify seller account
    const seller = await db.seller.findUnique({ where: { userId: authResult.user.id } })
    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Akun seller diperlukan untuk penarikan dana' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // SECURITY: Zod validation for all inputs
    const parsed = withdrawSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Input tidak valid' },
        { status: 400 }
      )
    }
    const { amount, bankAccount, bankName, bankHolder } = parsed.data

    // Validate minimum amount
    if (amount < 10000) {
      return NextResponse.json(
        { success: false, error: 'Penarikan minimal Rp 10.000' },
        { status: 400 }
      )
    }

    // Resolve bank details: body params override seller's stored bank details
    const resolvedBankAccount = bankAccount || seller.bankAccount
    const resolvedBankName = bankName || seller.bankName
    const resolvedBankHolder = bankHolder || seller.bankHolder

    if (!resolvedBankAccount || !resolvedBankName || !resolvedBankHolder) {
      return NextResponse.json(
        { success: false, error: 'Detail rekening bank tidak lengkap. Lengkapi di pengaturan toko.' },
        { status: 400 }
      )
    }

    // Get seller wallet
    const wallet = await db.wallet.findUnique({
      where: { sellerId: seller.id },
    }) || await db.wallet.findUnique({
      where: { userId: authResult.user.id },
    })

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet tidak ditemukan' },
        { status: 400 }
      )
    }

    // SECURITY: Check sufficient balance (only available balance, not hold/pending)
    if (Number(wallet.balance) < amount) {
      return NextResponse.json(
        { success: false, error: `Saldo tidak mencukupi. Saldo tersedia: Rp ${Number(wallet.balance).toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // SECURITY: Atomic transaction — move balance to holdBalance (escrow)
    const withdrawal = await db.$transaction(async (tx) => {
      // Re-fetch wallet inside transaction for latest balance
      const currentWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      })

      if (!currentWallet || Number(currentWallet.balance) < amount) {
        throw new Error('Saldo tidak mencukupi')
      }

      // RACE CONDITION FIX: Use updateMany with balance >= amount to prevent balance going negative
      const updateResult = await tx.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: amount } },
        data: {
          balance: { decrement: amount },
          holdBalance: { increment: amount },
        },
      })
      if (updateResult.count === 0) {
        throw new Error('Saldo tidak mencukupi')
      }

      // Re-fetch wallet to get the updated balance for the mutation record
      const updatedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      })

      // Create withdrawal record with PENDING status — admin must approve
      const newWithdrawal = await tx.withdrawal.create({
        data: {
          sellerId: seller.id,
          amount,
          bankAccount: resolvedBankAccount,
          bankName: resolvedBankName,
          bankHolder: resolvedBankHolder,
          status: 'pending', // NO auto-approve — admin must review
        },
      })

      // Create wallet mutation (debit from available balance to hold)
      await tx.walletMutation.create({
        data: {
          walletId: wallet.id,
          type: 'debit',
          amount,
          balance: updatedWallet!.balance,
          description: `Penarikan dana ke ${resolvedBankName} - ${resolvedBankAccount} (menunggu persetujuan admin)`,
          refType: 'withdraw',
          refId: newWithdrawal.id,
        },
      })

      // Create PENDING transaction record
      await tx.transaction.create({
        data: {
          userId: authResult.user.id,
          type: 'withdraw',
          amount,
          fee: 0,
          netAmount: amount,
          method: 'bank_transfer',
          status: 'pending', // NOT success — awaiting admin approval
          description: `Penarikan dana ke ${resolvedBankName} - ${resolvedBankAccount}`,
          refId: newWithdrawal.id,
        },
      })

      return newWithdrawal
    })

    logBusinessEvent({
      event: 'WITHDRAWAL_REQUESTED',
      userId: authResult.user.id,
      details: { withdrawalId: withdrawal.id, amount, bankName: resolvedBankName },
    })

    // Auto-create work item for Finance division
    await createWorkItemFromEntity({
      type: 'withdrawal',
      title: `Penarikan Dana: ${seller.storeName} - Rp ${amount.toLocaleString('id-ID')}`,
      description: `Penarikan dana Rp ${amount.toLocaleString('id-ID')} ke ${resolvedBankName} - ${resolvedBankAccount} (${resolvedBankHolder})`,
      refType: 'withdrawal',
      refId: withdrawal.id,
      metadata: { amount, bankName: resolvedBankName, sellerId: seller.id, storeName: seller.storeName },
      priority: amount >= 1000000 ? 'high' : 'normal',
      createdBy: authResult.user.id,
    }).catch(err => logger.warn({ err }, 'Failed to auto-create withdrawal work item'))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: withdrawal,
      message: 'Permintaan penarikan dana dibuat. Menunggu persetujuan admin (1x24 jam).',
    }), { status: 201 })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'POST /api/wallet/withdraw error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
