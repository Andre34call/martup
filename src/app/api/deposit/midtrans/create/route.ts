import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { paymentLimiter, rateLimitHeaders } from '@/lib/rate-limit'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'
import { validateCsrfRequest } from '@/lib/csrf'

import { MIDTRANS_SERVER_KEY, MIDTRANS_SERVER_IS_PRODUCTION, SNAP_API_URL, MIDTRANS_AUTH_HEADER } from '@/lib/midtrans-config'

// ==================== MIDTRANS DEPOSIT CREATE ====================
// Creates a deposit with Midtrans Snap token for automatic payment verification.
// Supports VA (BCA, Mandiri, BNI, BRI, Permata) and e-wallets (GoPay, ShopeePay, QRIS).
// Payment is verified automatically via Midtrans webhook — no admin verification needed.

const MIDTRANS_IS_PRODUCTION = MIDTRANS_SERVER_IS_PRODUCTION
const SNAP_URL = SNAP_API_URL

// Amount limits
const MIN_AMOUNT = 10_000
const MAX_AMOUNT = 10_000_000

// Midtrans-enabled payment methods for deposits
const VALID_MIDTRANS_METHODS = ['bank_transfer', 'gopay', 'shopeepay', 'qris']

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Virtual Account',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  qris: 'QRIS',
}

// Get base URL for Midtrans callbacks
function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL !== 'http://localhost:3000') return process.env.NEXTAUTH_URL
  return process.env.NEXTAUTH_URL || 'http://localhost:3000'
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit — 5 deposit requests per minute per user
    const rlResult = await paymentLimiter.check(`deposit-midtrans:${authResult.user.id}`)
    if (!rlResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429, headers: rateLimitHeaders(rlResult) }
      )
    }

    // SECURITY: CSRF protection
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json(
        { success: false, error: 'Keamanan request tidak valid. Refresh halaman dan coba lagi.' },
        { status: 403 }
      )
    }

    // Check Midtrans is configured
    if (!MIDTRANS_SERVER_KEY) {
      logger.error('MIDTRANS_SERVER_KEY not configured — cannot create Midtrans deposit')
      return NextResponse.json(
        { success: false, error: 'Pembayaran Midtrans belum dikonfigurasi. Hubungi admin.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { amount, method } = body as { amount?: number; method?: string }

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      return NextResponse.json(
        { success: false, error: 'Jumlah top up harus berupa bilangan bulat lebih dari 0' },
        { status: 400 }
      )
    }

    if (amount < MIN_AMOUNT) {
      return NextResponse.json(
        { success: false, error: `Top up minimal Rp ${MIN_AMOUNT.toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    if (amount > MAX_AMOUNT) {
      return NextResponse.json(
        { success: false, error: `Top up maksimal Rp ${MAX_AMOUNT.toLocaleString('id-ID')} per transaksi` },
        { status: 400 }
      )
    }

    // Validate method
    if (!method || !VALID_MIDTRANS_METHODS.includes(method)) {
      return NextResponse.json(
        { success: false, error: `Metode pembayaran tidak valid. Pilih: ${VALID_MIDTRANS_METHODS.join(', ')}` },
        { status: 400 }
      )
    }

    // Get user info for Midtrans customer_details
    const user = await db.user.findUnique({
      where: { id: authResult.user.id },
      select: { id: true, name: true, email: true, phone: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    // Set expiry to 24 hours from now
    const expiredAt = new Date()
    expiredAt.setHours(expiredAt.getHours() + 24)

    // SECURITY: Create deposit + call Midtrans atomically
    const result = await db.$transaction(async (tx) => {
      // Step 1: Create deposit record with midtrans method
      const deposit = await tx.deposit.create({
        data: {
          userId: authResult.user.id,
          amount,
          method: 'midtrans',
          status: 'pending',
          expiredAt,
        },
      })

      // Step 2: Generate Midtrans order_id using deposit ID for uniqueness
      const midtransOrderId = `DEPOSIT-${deposit.id}`

      // Update deposit with midtransOrderId
      await tx.deposit.update({
        where: { id: deposit.id },
        data: { midtransOrderId },
      })

      // Step 3: Build Midtrans Snap payload
      // Enabled payments based on selected method
      const enabledPayments = getEnabledPayments(method)

      const midtransPayload = {
        transaction_details: {
          order_id: midtransOrderId,
          gross_amount: amount,
        },
        item_details: [
          {
            id: 'top-up',
            price: amount,
            quantity: 1,
            name: 'Top Up Saldo MartUp',
          },
        ],
        customer_details: {
          first_name: user.name,
          email: user.email,
          phone: user.phone || undefined,
        },
        enabled_payments: enabledPayments,
        callbacks: {
          finish: `${getBaseUrl()}/?screen=deposit-detail&id=${deposit.id}`,
          error: `${getBaseUrl()}/?screen=deposit-detail&id=${deposit.id}`,
          pending: `${getBaseUrl()}/?screen=deposit-detail&id=${deposit.id}`,
        },
        expiry: {
          start_time: new Date().toISOString().replace(/\.\d{3}Z$/, '+07:00'),
          unit: 'hours',
          duration: 24,
        },
      }

      // Step 4: Call Midtrans Snap API
      const authString = MIDTRANS_AUTH_HEADER

      const snapResponse = await fetch(SNAP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Basic ${authString}`,
        },
        body: JSON.stringify(midtransPayload),
      })

      const snapData = await snapResponse.json()

      if (!snapResponse.ok) {
        // Detailed error logging for debugging
        logger.error({
          err: snapData,
          midtransOrderId,
          statusCode: snapResponse.status,
          isProduction: MIDTRANS_IS_PRODUCTION,
          keyPrefix: MIDTRANS_SERVER_KEY.substring(0, 12) + '...',
          amount,
          method,
        }, 'Midtrans Snap API error for deposit')
        // Update deposit status to failed
        await tx.deposit.update({
          where: { id: deposit.id },
          data: { status: 'failed' },
        })
        const midtransError = snapData.error_messages?.[0] || snapData.validation_messages?.[0] || ''
        throw new Error(midtransError || 'Failed to create Midtrans transaction')
      }

      const { token, redirect_url } = snapData

      // Step 5: Update deposit with snap token
      await tx.deposit.update({
        where: { id: deposit.id },
        data: { snapToken: token },
      })

      // Step 6: Create a PENDING transaction record
      await tx.transaction.create({
        data: {
          userId: authResult.user.id,
          type: 'deposit',
          amount,
          fee: 0,
          netAmount: amount,
          method: 'midtrans',
          status: 'pending',
          description: `Top Up via Midtrans (${METHOD_LABELS[method] || method}) — menunggu pembayaran`,
          refId: deposit.id,
        },
      })

      return { deposit, token, redirectUrl: redirect_url, midtransOrderId }
    })

    logBusinessEvent({
      event: 'DEPOSIT_MIDTRANS_CREATED',
      userId: authResult.user.id,
      details: {
        depositId: result.deposit.id,
        amount,
        method,
        midtransOrderId: result.midtransOrderId,
      },
    })

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        depositId: result.deposit.id,
        amount,
        method,
        methodLabel: METHOD_LABELS[method] || method,
        status: 'pending',
        snapToken: result.token,
        redirectUrl: result.redirectUrl,
        midtransOrderId: result.midtransOrderId,
        expiredAt: expiredAt.toISOString(),
        message: 'Deposit Midtrans dibuat. Selesaikan pembayaran melalui popup Snap.',
      },
    }), { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      const msg = error.message
      // Midtrans API errors — provide user-friendly translations
      if (msg.includes('access denied') || msg.includes('unauthorized')) {
        return NextResponse.json(
          { success: false, error: 'Kunci API Midtrans tidak valid. Pastikan Server Key dan Client Key dari environment yang sama. Hubungi admin.' },
          { status: 502 }
        )
      }
      if (msg.includes('already been taken') || msg.includes('order_id')) {
        return NextResponse.json(
          { success: false, error: 'ID transaksi sudah digunakan. Coba lagi.' },
          { status: 502 }
        )
      }
      if (msg.includes('Failed to create Midtrans') || msg.includes('gross_amount') || msg.includes('item_details')) {
        return NextResponse.json(
          { success: false, error: 'Gagal membuat transaksi Midtrans. Coba lagi nanti.' },
          { status: 502 }
        )
      }
    }
    logger.error({ err: error }, 'Midtrans Deposit Create POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

/**
 * Get enabled payment methods for Midtrans Snap based on selected method.
 * Each "method" maps to specific Midtrans payment types.
 */
function getEnabledPayments(method: string): string[] {
  switch (method) {
    case 'bank_transfer':
      return ['bca_va', 'bni_va', 'bri_va', 'mandiri_va', 'permata_va', 'other_va']
    case 'gopay':
      return ['gopay']
    case 'shopeepay':
      return ['shopeepay']
    case 'qris':
      return ['qris']
    default:
      // If no specific method, enable all common methods
      return ['bca_va', 'bni_va', 'bri_va', 'mandiri_va', 'gopay', 'shopeepay', 'qris']
  }
}
