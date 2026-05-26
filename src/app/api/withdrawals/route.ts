import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, verifyAdmin, checkRateLimit, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logSecurityEvent } from '@/lib/logger'

// ==================== WITHDRAWALS LIST ====================
// SECURITY: Sellers can only see their own withdrawals
// Admins can see all withdrawals (for approval management)

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const { searchParams } = request.nextUrl
    const sellerId = searchParams.get('sellerId')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    const where: Record<string, unknown> = {}

    // SECURITY: Non-admin users can only see their own withdrawals
    if (authResult.user.role === 'admin') {
      // Admin can filter by sellerId or see all
      if (sellerId) where.sellerId = sellerId
    } else {
      // Non-admin: must be a seller, can only see their own
      const seller = await db.seller.findUnique({ where: { userId: authResult.user.id } })
      if (!seller) {
        return NextResponse.json(
          { success: false, error: 'Akun seller diperlukan' },
          { status: 403 }
        )
      }
      // SECURITY: Force sellerId to the authenticated seller — ignore any provided sellerId
      where.sellerId = seller.id
    }

    if (status) where.status = status

    const skip = (page - 1) * limit

    const [withdrawals, total] = await Promise.all([
      db.withdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.withdrawal.count({ where }),
    ])

    return NextResponse.json(serializeDecimal({
      success: true,
      data: withdrawals,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Get withdrawals error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
