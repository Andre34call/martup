import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logSecurityEvent, logBusinessEvent } from '@/lib/logger'

// ==================== WALLET TOP UP ====================
// SECURITY: Requires authentication + ownership verification
// Creates a PENDING deposit — must be verified by payment gateway or admin
// BEFORE balance is credited. No auto-approve.

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit — 5 top-up requests per minute per user
    if (!checkRateLimit(`topup:${authResult.user.id}`, 5)) {
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
        { success: false, error: 'Jumlah top up harus lebih dari 0' },
        { status: 400 }
      )
    }

    // SECURITY: Cap top-up amount
    if (amount > 10000000) {
      return NextResponse.json(
        { success: false, error: 'Top up maksimal Rp 10.000.000 per transaksi' },
        { status: 400 }
      )
    }

    if (amount < 10000) {
      return NextResponse.json(
        { success: false, error: 'Top up minimal Rp 10.000' },
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

    // Create PENDING deposit record — NO balance credit until payment verified
    const deposit = await db.deposit.create({
      data: {
        userId: authResult.user.id,
        amount,
        method,
        status: 'pending', // MUST remain pending until payment gateway confirms
      },
    })

    // Create a PENDING transaction record
    await db.transaction.create({
      data: {
        userId: authResult.user.id,
        type: 'deposit',
        amount,
        fee: 0,
        netAmount: amount,
        method,
        status: 'pending', // NOT success — awaiting payment
        description: `Top up via ${method} — menunggu pembayaran`,
        refId: deposit.id,
      },
    })

    logBusinessEvent({
      event: 'DEPOSIT_REQUESTED',
      userId: authResult.user.id,
      details: { depositId: deposit.id, amount, method },
    })

    // In production: integrate with Midtrans/payment gateway here to create payment token
    // For now, return the deposit ID so the client can redirect to payment
    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        depositId: deposit.id,
        amount,
        method,
        status: 'pending',
        message: 'Deposit dibuat. Silakan selesaikan pembayaran.',
      },
    }), { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Top up error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
