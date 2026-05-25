import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-helpers'

// GET /api/wallet/mutations — Get wallet mutation history
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = request.nextUrl

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const type = searchParams.get('type') // credit, debit

    // Get or create wallet
    let wallet = await db.wallet.findUnique({
      where: { userId: user.id },
    })

    if (!wallet) {
      wallet = await db.wallet.create({
        data: {
          userId: user.id,
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
    console.error('GET /api/wallet/mutations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wallet mutations' },
      { status: 500 }
    )
  }
}
