import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { Prisma } from '@prisma/client'

// Minimum withdrawal amount in IDR
const MIN_WITHDRAWAL_AMOUNT = 10000

// ==================== POST /api/seller/withdraw ====================
// Create a new withdrawal request for the authenticated seller

export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 2: Rate limit — 5 withdrawal requests per minute
    const rateLimitId = `seller-withdraw-post-${authResult.user.id}`
    if (!checkRateLimit(rateLimitId, 5)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 5 withdrawal requests per minute.' },
        { status: 429 }
      )
    }

    // Step 3: Verify the authenticated user has a Seller record
    const seller = await db.seller.findFirst({
      where: { userId: authResult.user.id },
      select: {
        id: true,
        storeName: true,
        bankAccount: true,
        bankName: true,
        bankHolder: true,
      },
    })

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Seller account required' },
        { status: 403 }
      )
    }

    // Step 4: Parse and validate request body
    const body = await request.json()
    const { amount, bankAccount, bankName, bankHolder } = body

    // Resolve bank details: use provided values or fall back to seller's stored details
    const resolvedBankAccount = bankAccount || seller.bankAccount
    const resolvedBankName = bankName || seller.bankName
    const resolvedBankHolder = bankHolder || seller.bankHolder

    // Validate bank details are complete
    if (!resolvedBankAccount || !resolvedBankName || !resolvedBankHolder) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bank details are incomplete. Please provide bankAccount, bankName, and bankHolder, or update your seller profile with bank details.',
        },
        { status: 400 }
      )
    }

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json(
        { success: false, error: `Minimum withdrawal amount is Rp ${MIN_WITHDRAWAL_AMOUNT.toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // Step 5: Use a transaction to atomically check wallet balance and move funds to hold
    const withdrawal = await db.$transaction(async (tx) => {
      // Find the seller's wallet
      const wallet = await tx.wallet.findUnique({
        where: { sellerId: seller.id },
      })

      if (!wallet) {
        throw new Error('Wallet not found for this seller')
      }

      // Check available balance (balance - holdBalance is the actual available amount)
      const availableBalance = Number(wallet.balance) - Number(wallet.holdBalance)

      if (amount > availableBalance) {
        throw new Error(`Insufficient balance. Available: Rp ${availableBalance.toLocaleString('id-ID')}, Requested: Rp ${amount.toLocaleString('id-ID')}`)
      }

      // Atomically move amount from balance to holdBalance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
          holdBalance: { increment: amount },
        },
      })

      // Create the withdrawal record
      const newWithdrawal = await tx.withdrawal.create({
        data: {
          sellerId: seller.id,
          amount: new Prisma.Decimal(amount),
          bankAccount: resolvedBankAccount,
          bankName: resolvedBankName,
          bankHolder: resolvedBankHolder,
          status: 'pending',
        },
      })

      // Create a wallet mutation record (debit)
      const newBalance = Number(updatedWallet.balance)
      await tx.walletMutation.create({
        data: {
          walletId: wallet.id,
          type: 'debit',
          amount: new Prisma.Decimal(amount),
          balance: new Prisma.Decimal(newBalance),
          description: `Withdrawal request - Rp ${amount.toLocaleString('id-ID')} to ${resolvedBankName} (${resolvedBankAccount})`,
          refType: 'withdraw',
          refId: newWithdrawal.id,
        },
      })

      return newWithdrawal
    })

    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: {
          id: withdrawal.id,
          sellerId: withdrawal.sellerId,
          amount: withdrawal.amount,
          bankAccount: withdrawal.bankAccount,
          bankName: withdrawal.bankName,
          bankHolder: withdrawal.bankHolder,
          status: withdrawal.status,
          createdAt: withdrawal.createdAt,
          updatedAt: withdrawal.updatedAt,
        },
      }),
      { status: 201 }
    )
  } catch (error: unknown) {
    // Handle known business logic errors from the transaction
    if (error instanceof Error) {
      if (error.message === 'Wallet not found for this seller') {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        )
      }
      if (error.message.startsWith('Insufficient balance')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Seller Withdraw POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== GET /api/seller/withdraw ====================
// List seller's withdrawals or get a single withdrawal by id

export async function GET(request: NextRequest) {
  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 2: Verify the authenticated user has a Seller record
    const seller = await db.seller.findFirst({
      where: { userId: authResult.user.id },
      select: { id: true, storeName: true },
    })

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Seller account required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const withdrawalId = searchParams.get('id')

    // --- Single withdrawal lookup ---
    if (withdrawalId) {
      const withdrawal = await db.withdrawal.findUnique({
        where: { id: withdrawalId },
      })

      if (!withdrawal) {
        return NextResponse.json(
          { success: false, error: 'Withdrawal not found' },
          { status: 404 }
        )
      }

      // SECURITY: Verify the withdrawal belongs to this seller
      if (withdrawal.sellerId !== seller.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden - You can only view your own withdrawals' },
          { status: 403 }
        )
      }

      return NextResponse.json(
        serializeDecimal({
          success: true,
          data: withdrawal,
        })
      )
    }

    // --- List withdrawals ---
    const requestedSellerId = searchParams.get('sellerId')
    const status = searchParams.get('status')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    // SECURITY: Verify the sellerId matches the authenticated seller
    const targetSellerId = requestedSellerId || seller.id
    if (targetSellerId !== seller.id && authResult.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only view your own withdrawals' },
        { status: 403 }
      )
    }

    // Parse pagination parameters
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 20
    const offset = offsetParam ? Math.max(parseInt(offsetParam, 10) || 0, 0) : 0

    // Build where clause
    const where: Record<string, unknown> = { sellerId: targetSellerId }
    if (status && status !== 'all') {
      where.status = status
    }

    // Fetch withdrawals and total count in parallel
    const [withdrawals, total] = await Promise.all([
      db.withdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.withdrawal.count({ where }),
    ])

    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: withdrawals,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      })
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Seller Withdraw GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
