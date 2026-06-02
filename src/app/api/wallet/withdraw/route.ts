import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'
import { createWorkItemFromEntity } from '@/lib/workflow'

// ==================== WALLET WITHDRAW ====================
// SECURITY: Requires authentication + seller verification
// Creates a PENDING withdrawal — MUST be approved by admin
// Balance is moved to holdBalance (escrow) until admin approves/rejects
// Rejection refunds the holdBalance back to balance

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit — 3 withdrawal requests per minute per user
    if (!checkRateLimit(`withdraw:${authResult.user.id}`, 3)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
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
    const { amount, bankAccount, bankName, bankHolder } = body as {
      amount?: number
      bankAccount?: string
      bankName?: string
      bankHolder?: string
    }

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      return NextResponse.json(
        { success: false, error: 'Jumlah penarikan harus berupa bilangan bulat lebih dari 0' },
        { status: 400 }
      )
    }

    if (amount < 10000) {
      return NextResponse.json(
        { success: false, error: 'Penarikan minimal Rp 10.000' },
        { status: 400 }
      )
    }

    // Validate bank details
    if (!bankAccount || !bankName || !bankHolder) {
      return NextResponse.json(
        { success: false, error: 'Detail rekening bank wajib diisi: bankAccount, bankName, bankHolder' },
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
        { success: false, error: 'Saldo tidak mencukupi' },
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

      // Move amount from balance to holdBalance (escrow until admin approves)
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
          holdBalance: { increment: amount },
        },
      })

      // SECURITY: Verify balance didn't go negative (safety net)
      if (updatedWallet.balance.lessThan(0)) {
        throw new Error('INSUFFICIENT_BALANCE')
      }

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
          balance: updatedWallet.balance,
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
