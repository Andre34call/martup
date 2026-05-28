import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// GET /api/wallet/mutations — Get wallet mutation history
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Use verifyAuth (supports both NextAuth session and bearer tokens)
    // Previously used requireAuth which only checked NextAuth sessions,
    // preventing email/password users from accessing their wallet mutations.
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }
    const userId = authResult.user.id
    const { searchParams } = request.nextUrl

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const type = searchParams.get('type') // credit, debit

    // Get or create wallet
    let wallet = await db.wallet.findUnique({
      where: { userId },
    })

    if (!wallet) {
      wallet = await db.wallet.create({
        data: {
          userId,
          balance: 0,
          holdBalance: 0,
        },
      })
    }

    const where: Record<string, unknown> = {
      walletId: wallet.id,
    }

    if (type) {
      where.type = type
    }

    const skip = (page - 1) * limit

    const [mutations, total] = await Promise.all([
      db.walletMutation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.walletMutation.count({ where }),
    ])

    return NextResponse.json({
      items: mutations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error({ err: error }, 'GET /api/wallet/mutations error')
    return NextResponse.json(
      { error: 'Failed to fetch wallet mutations' },
      { status: 500 }
    )
  }
}
