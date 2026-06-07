import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { paymentLimiter, rateLimitHeaders } from '@/lib/rate-limit'
import { serializeDecimal } from '@/lib/decimal-utils'
import { Prisma } from '@prisma/client'
import { validateBody, sellerWithdrawSchema } from '@/lib/validations'
import { validateCsrfRequest } from '@/lib/csrf'

import { logger } from '@/lib/logger'

// Minimum withdrawal amount in IDR (fallback, overridden by platform settings)
const DEFAULT_MIN_WITHDRAWAL = 10000

/**
 * Read minWithdrawal from PlatformSetting table.
 * Returns the default if settings are not configured or DB read fails.
 */
async function getMinWithdrawal(): Promise<number> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: 'platform_settings' } })
    if (row) {
      const settings = JSON.parse(row.value) as Record<string, number | boolean | string>
      if (typeof settings.minWithdrawal === 'number' && settings.minWithdrawal >= 10000) {
        return settings.minWithdrawal
      }
    }
  } catch {
    // Fallback to default
  }
  return DEFAULT_MIN_WITHDRAWAL
}

// ==================== POST /api/seller/withdraw ====================
// Create a new withdrawal request for the authenticated seller

export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 2: Rate limit — 5 withdrawal requests per minute
    const rlResult = await paymentLimiter.check(`seller-withdraw-post-${authResult.user.id}`)
    if (!rlResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 5 withdrawal requests per minute.' },
        { status: 429, headers: rateLimitHeaders(rlResult) }
      )
    }

    // SECURITY: CSRF protection
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json({ success: false, error: 'Keamanan request tidak valid. Refresh halaman dan coba lagi.' }, { status: 403 })
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

    // Zod validation
    const validation = validateBody(sellerWithdrawSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { amount } = validation.data
    const { bankAccount, bankName, bankHolder } = validation.data

    // Resolve bank details: use provided values or fall back to seller's stored details
    // SECURITY: Sanitize bank detail strings to prevent XSS
    const sanitizeString = (val: unknown): string | undefined => {
      if (typeof val !== 'string') return undefined
      return val.trim().slice(0, 100).replace(/[<>"'&]/g, '')
    }
    const resolvedBankAccount = sanitizeString(bankAccount) || sanitizeString(seller.bankAccount)
    const resolvedBankName = sanitizeString(bankName) || sanitizeString(seller.bankName)
    const resolvedBankHolder = sanitizeString(bankHolder) || sanitizeString(seller.bankHolder)

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

    // Validate amount (minimum check — actual min comes from platform settings)
    const minWithdrawal = await getMinWithdrawal()
    if (amount < minWithdrawal) {
      return NextResponse.json(
        { success: false, error: `Minimum withdrawal amount is Rp ${minWithdrawal.toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // SECURITY: Cap maximum withdrawal amount to prevent draining entire balance at once
    const MAX_WITHDRAWAL = 10_000_000 // Rp 10,000,000 per transaction
    if (amount > MAX_WITHDRAWAL) {
      return NextResponse.json(
        { success: false, error: `Maximum withdrawal amount is Rp ${MAX_WITHDRAWAL.toLocaleString('id-ID')} per transaction` },
        { status: 400 }
      )
    }

    // Step 5: Use a transaction to atomically check wallet balance and move funds to hold
    const withdrawal = await db.$transaction(async (tx) => {
      // Find the seller's wallet (unified — one wallet per user)
      const wallet = await tx.wallet.findUnique({
        where: { userId: authResult.user.id },
      })

      if (!wallet) {
        throw new Error('Wallet not found for this seller')
      }

      // SECURITY: Use atomic updateMany with balance >= amount check to prevent
      // double-withdrawal race condition. Two concurrent withdrawals could both
      // pass the separate balance check before either decrements, causing negative balance.
      // With updateMany, only one concurrent request will match the balance condition.
      const updateResult = await tx.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: amount } },
        data: {
          balance: { decrement: amount },
          holdBalance: { increment: amount },
        },
      })

      if (updateResult.count === 0) {
        throw new Error('Insufficient balance')
      }

      // Re-fetch wallet to get updated balance for the mutation record
      const updatedWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      })

      if (!updatedWallet) {
        throw new Error('Wallet not found after update — data integrity issue')
      }

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
          { success: false, error: 'Wallet tidak ditemukan' },
          { status: 404 }
        )
      }
      if (error.message.startsWith('Insufficient balance')) {
        return NextResponse.json(
          { success: false, error: 'Saldo tidak mencukupi' },
          { status: 400 }
        )
      }
    }
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Seller Withdraw POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
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

    // Step 2: Rate limit GET requests
    const rlResult = await paymentLimiter.check(`seller-withdraw-get:${authResult.user.id}`)
    if (!rlResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Try again in a minute.' },
        { status: 429, headers: rateLimitHeaders(rlResult) }
      )
    }

    // Step 3: Verify the authenticated user has a Seller record
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
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Seller Withdraw GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
