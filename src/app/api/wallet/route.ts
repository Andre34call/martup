import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/wallet - Fetch wallet for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    const wallet = await db.wallet.findUnique({
      where: { userId },
      include: {
        mutations: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: wallet,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Wallet GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/wallet - Top up wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, amount } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number' },
        { status: 400 }
      )
    }

    // Use transaction to update wallet and create mutation record
    const wallet = await db.$transaction(async (tx) => {
      // Find or create wallet
      let existingWallet = await tx.wallet.findUnique({ where: { userId } })

      if (!existingWallet) {
        existingWallet = await tx.wallet.create({
          data: {
            userId,
            balance: 0,
            holdBalance: 0,
          },
        })
      }

      const newBalance = existingWallet.balance + amount

      // Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      })

      // Create mutation record
      await tx.walletMutation.create({
        data: {
          walletId: updatedWallet.id,
          type: 'credit',
          amount,
          balance: newBalance,
          description: `Top up wallet - Rp ${amount.toLocaleString('id-ID')}`,
          refType: 'deposit',
        },
      })

      return updatedWallet
    })

    // Fetch wallet with mutations for response
    const walletWithMutations = await db.wallet.findUnique({
      where: { userId },
      include: {
        mutations: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: walletWithMutations,
    }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Wallet POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
