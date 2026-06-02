import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

// GET /api/wallet/deposits/[id] - Get single deposit detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const { id: depositId } = await params

    if (!checkRateLimit(`deposit-detail:${authResult.user.id}`, 20)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const deposit = await db.deposit.findUnique({
      where: { id: depositId },
    })

    if (!deposit) {
      return NextResponse.json(
        { success: false, error: 'Deposit tidak ditemukan' },
        { status: 404 }
      )
    }

    // SECURITY: Users can only view their own deposits
    if (deposit.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke deposit ini' },
        { status: 403 }
      )
    }

    const mapped = {
      id: deposit.id,
      amount: Number(deposit.amount),
      method: deposit.method,
      status: deposit.status,
      proofUrl: deposit.proofUrl,
      adminNote: deposit.adminNote,
      destinationAccount: deposit.destinationAccount,
      senderName: deposit.senderName,
      expiredAt: deposit.expiredAt?.toISOString() || null,
      createdAt: deposit.createdAt.toISOString(),
      updatedAt: deposit.updatedAt.toISOString(),
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: mapped,
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'GET /api/wallet/deposits/[id] error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
