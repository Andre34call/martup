import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logBusinessEvent } from '@/lib/logger'

// ==================== WALLET DEPOSIT ====================
// SECURITY: Requires authentication
// Creates a PENDING deposit — NO balance credit until payment confirmed
// Payment confirmation happens via /api/payment/notification (Midtrans webhook)
// or admin manual approval via /api/admin/deposits

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit — 5 deposit requests per minute per user
    if (!checkRateLimit(`deposit:${authResult.user.id}`, 5)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { amount, method } = body as { amount?: number; method?: string }

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Jumlah deposit harus lebih dari 0' },
        { status: 400 }
      )
    }

    if (amount < 10000) {
      return NextResponse.json(
        { success: false, error: 'Deposit minimal Rp 10.000' },
        { status: 400 }
      )
    }

    if (amount > 10000000) {
      return NextResponse.json(
        { success: false, error: 'Deposit maksimal Rp 10.000.000 per transaksi' },
        { status: 400 }
      )
    }

    // Validate method
    const validMethods = ['bank_transfer', 'gopay', 'ovo', 'dana']
    if (!method || !validMethods.includes(method)) {
      return NextResponse.json(
        { success: false, error: `Metode pembayaran tidak valid. Pilih: ${validMethods.join(', ')}` },
        { status: 400 }
      )
    }

    // Create PENDING deposit — NO balance credit until payment gateway confirms
    const deposit = await db.deposit.create({
      data: {
        userId: authResult.user.id,
        amount,
        method,
        status: 'pending', // MUST remain pending until payment is verified
      },
    })

    // Create PENDING transaction record
    await db.transaction.create({
      data: {
        userId: authResult.user.id,
        type: 'deposit',
        amount,
        fee: 0,
        netAmount: amount,
        method,
        status: 'pending', // NOT success — awaiting payment confirmation
        description: `Deposit via ${method} — menunggu pembayaran`,
        refId: deposit.id,
      },
    })

    logBusinessEvent({
      event: 'DEPOSIT_REQUESTED',
      userId: authResult.user.id,
      details: { depositId: deposit.id, amount, method },
    })

    // In production: Call Midtrans/payment gateway to create payment token
    // For now, return deposit info for the client to process payment
    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        depositId: deposit.id,
        amount,
        method,
        status: 'pending',
        message: 'Deposit dibuat. Silakan selesaikan pembayaran sebelum saldo dikreditkan.',
      },
    }), { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('POST /api/wallet/deposit error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
