import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

// ==================== GET /api/deposit/status ====================
// Check deposit payment status. Used for polling after Midtrans Snap payment.
// Returns the deposit status so the frontend can show success/failure.

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { searchParams } = new URL(request.url)
    const depositId = searchParams.get('depositId')

    if (!depositId) {
      return NextResponse.json(
        { success: false, error: 'depositId query parameter is required' },
        { status: 400 }
      )
    }

    const deposit = await db.deposit.findUnique({
      where: { id: depositId },
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        paymentType: true,
        midtransOrderId: true,
        midtransTransactionId: true,
        snapToken: true,
        expiredAt: true,
        verifiedAt: true,
        createdAt: true,
        userId: true,
      },
    })

    if (!deposit) {
      return NextResponse.json(
        { success: false, error: 'Deposit tidak ditemukan' },
        { status: 404 }
      )
    }

    // SECURITY: Users can only check their own deposits (ALL deposit types)
    if (deposit.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke deposit ini' },
        { status: 403 }
      )
    }

    // Remove userId from response data
    const { userId: _, ...depositData } = deposit

    return NextResponse.json(serializeDecimal({
      success: true,
      data: depositData,
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Deposit Status GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
