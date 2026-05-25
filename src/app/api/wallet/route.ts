import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'

// GET /api/wallet - Fetch wallet for a user
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Users can only access their own wallet
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only access your own wallet' },
        { status: 403 }
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

    return NextResponse.json(serializeDecimal({
      success: true,
      data: wallet,
    }))
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
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // SECURITY: Rate limit wallet mutations
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`wallet:${clientIp}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { userId, amount } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Users can only top up their own wallet
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only top up your own wallet' },
        { status: 403 }
      )
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number' },
        { status: 400 }
      )
    }

    // SECURITY: Cap top-up amount to prevent abuse
    if (amount > 10000000) {
      return NextResponse.json(
        { success: false, error: 'Top up amount exceeds maximum limit (Rp 10.000.000)' },
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

      // SECURITY: Use atomic increment to prevent race condition on concurrent top-ups
      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: { balance: { increment: amount } },
      })
      // Get the new balance for the mutation record
      const freshWallet = await tx.wallet.findUnique({ where: { userId } })
      const newBalance = freshWallet!.balance

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

    return NextResponse.json(serializeDecimal({
      success: true,
      data: walletWithMutations,
    }), { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Wallet POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
