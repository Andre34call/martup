import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { paymentLimiter, rateLimitHeaders } from '@/lib/rate-limit'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

// GET /api/wallet/deposits - Get current user's deposit history
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const rlResult = await paymentLimiter.check(`deposits:${authResult.user.id}`)
    if (!rlResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429, headers: rateLimitHeaders(rlResult) }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { userId: authResult.user.id }
    // SECURITY: Validate status filter to prevent invalid Prisma queries
    const VALID_DEPOSIT_STATUSES = ['pending', 'proof_uploaded', 'success', 'failed', 'expired']
    if (status) {
      if (!VALID_DEPOSIT_STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, error: `Status tidak valid. Gunakan: ${VALID_DEPOSIT_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      where.status = status
    }

    const [deposits, total] = await Promise.all([
      db.deposit.findMany({
        where,
        include: {
          platformBankAccount: {
            select: {
              bankName: true,
              accountNumber: true,
              accountHolder: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.deposit.count({ where }),
    ])

    const mapped = deposits.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      method: d.method,
      status: d.status,
      proofUrl: d.proofUrl,
      adminNote: d.adminNote,
      platformBankAccount: d.platformBankAccount
        ? { bankName: d.platformBankAccount.bankName, accountNumber: d.platformBankAccount.accountNumber, accountHolder: d.platformBankAccount.accountHolder }
        : null,
      senderName: d.senderName,
      expiredAt: d.expiredAt?.toISOString() || null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        items: mapped,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'GET /api/wallet/deposits error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
