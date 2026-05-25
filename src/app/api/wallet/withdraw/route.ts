import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSeller } from '@/lib/auth-helpers'

// POST /api/wallet/withdraw — Request withdrawal (seller only)
export async function POST(request: NextRequest) {
  try {
    const { user, seller } = await requireSeller()

    const body = await request.json()
    const { amount, bankAccount, bankName, bankHolder } = body as {
      amount?: number
      bankAccount?: string
      bankName?: string
      bankHolder?: string
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (!bankAccount || !bankName || !bankHolder) {
      return NextResponse.json(
        { error: 'Bank account details are required: bankAccount, bankName, bankHolder' },
        { status: 400 }
      )
    }

    // Get seller wallet
    let wallet = await db.wallet.findUnique({
      where: { sellerId: seller.id },
    })

    if (!wallet) {
      wallet = await db.wallet.findUnique({
        where: { userId: user.id },
      })
    }

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 400 }
      )
    }

    // Check sufficient balance
    if (wallet.balance < amount) {
      return NextResponse.json(
        { error: 'Insufficient wallet balance' },
        { status: 400 }
      )
    }

    const withdrawal = await db.$transaction(async (tx) => {
      // Deduct from wallet
      const newBalance = wallet!.balance - amount
      await tx.wallet.update({
        where: { id: wallet!.id },
        data: { balance: newBalance },
      })

      // Create withdrawal record
      const newWithdrawal = await tx.withdrawal.create({
        data: {
          sellerId: seller.id,
          amount,
          bankAccount,
          bankName,
          bankHolder,
          status: 'pending',
        },
      })

      // Auto-approve withdrawal (in production, admin would approve)
      await tx.withdrawal.update({
        where: { id: newWithdrawal.id },
        data: {
          status: 'approved',
          processedAt: new Date(),
        },
      })

      // Record wallet mutation
      await tx.walletMutation.create({
        data: {
          walletId: wallet!.id,
          type: 'debit',
          amount,
          balance: newBalance,
          description: `Withdrawal to ${bankName} - ${bankAccount}`,
          refType: 'withdraw',
          refId: newWithdrawal.id,
        },
      })

      // Record transaction
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'withdraw',
          amount,
          fee: 0,
          netAmount: amount,
          method: 'bank_transfer',
          status: 'success',
          description: `Withdrawal to ${bankName} - ${bankAccount}`,
          refId: newWithdrawal.id,
        },
      })

      return newWithdrawal
    })

    return NextResponse.json(withdrawal, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Seller account required') {
      return NextResponse.json({ error: 'Seller account required' }, { status: 403 })
    }
    console.error('POST /api/wallet/withdraw error:', error)
    return NextResponse.json(
      { error: 'Failed to process withdrawal' },
      { status: 500 }
    )
  }
}
