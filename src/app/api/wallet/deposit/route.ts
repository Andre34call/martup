import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-helpers'

// POST /api/wallet/deposit — Request deposit (top up)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { amount, method } = body as { amount?: number; method?: string }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (!method) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      )
    }

    const validMethods = ['bank_transfer', 'gopay', 'ovo', 'dana']
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: `Invalid method. Must be one of: ${validMethods.join(', ')}` },
        { status: 400 }
      )
    }

    // Create deposit record
    const deposit = await db.$transaction(async (tx) => {
      const newDeposit = await tx.deposit.create({
        data: {
          userId: user.id,
          amount,
          method,
          status: 'pending',
        },
      })

      // Auto-approve deposit (in production, this would integrate with payment gateway)
      await tx.deposit.update({
        where: { id: newDeposit.id },
        data: { status: 'success' },
      })

      // Get or create wallet
      let wallet = await tx.wallet.findUnique({
        where: { userId: user.id },
      })

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: user.id,
            balance: 0,
            holdBalance: 0,
          },
        })
      }

      // Credit wallet
      const newBalance = wallet.balance + amount
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      })

      // Record wallet mutation
      await tx.walletMutation.create({
        data: {
          walletId: wallet.id,
          type: 'credit',
          amount,
          balance: newBalance,
          description: `Top up via ${method}`,
          refType: 'deposit',
          refId: newDeposit.id,
        },
      })

      // Record transaction
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'deposit',
          amount,
          fee: 0,
          netAmount: amount,
          method,
          status: 'success',
          description: `Wallet top up via ${method}`,
          refId: newDeposit.id,
        },
      })

      return newDeposit
    })

    return NextResponse.json(deposit, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('POST /api/wallet/deposit error:', error)
    return NextResponse.json(
      { error: 'Failed to process deposit' },
      { status: 500 }
    )
  }
}
