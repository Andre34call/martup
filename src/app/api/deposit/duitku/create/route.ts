import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { paymentLimiter, rateLimitHeaders } from '@/lib/rate-limit'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'
import { validateCsrfRequest } from '@/lib/csrf'
import {
  isDuitkuConfigured,
  isDuitkuProduction,
  createDuitkuInvoice,
} from '@/lib/duitku'

// ==================== DUITKU DEPOSIT CREATE ====================
// Creates a wallet top-up deposit with a Duitku invoice for automatic payment
// verification. Payment is confirmed via the Duitku webhook (/api/payment/callback,
// merchantOrderId = DEPOSIT-{id}) — no admin verification needed.
//
// The paymentUrl is stored in the deposit's snapToken column (legacy field name —
// schema is unchanged; semantically it now holds the Duitku payment URL).

// Amount limits
const MIN_AMOUNT = 10_000
const MAX_AMOUNT = 10_000_000
// Invoice expiry in minutes (Duitku common values: 5/10/60)
const EXPIRY_MINUTES = 60

/** Translate raw gateway errors into buyer-friendly Indonesian messages. */
function friendlyGatewayError(message?: string): string {
  const msg = (message || '').toLowerCase()
  if (msg.includes('exceeded') || msg.includes('limit')) {
    return 'Melebihi limit transaksi channel ini. Coba nominal lebih kecil atau gunakan Virtual Account.'
  }
  if (msg.includes('payment method') || msg.includes('invalid method') || msg.includes('not available')) {
    return 'Channel pembayaran tidak tersedia untuk nominal ini. Silakan pilih channel lain.'
  }
  return message || 'Gagal membuat transaksi pembayaran. Coba lagi nanti.'
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit — 5 deposit requests per minute per user
    const rlResult = await paymentLimiter.check(`deposit-duitku:${authResult.user.id}`)
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

    // Check Duitku is configured
    if (!isDuitkuConfigured()) {
      logger.error('DUITKU_MERCHANT_CODE / DUITKU_API_KEY not configured — cannot create Duitku deposit')
      return NextResponse.json(
        { success: false, error: 'Pembayaran Duitku belum dikonfigurasi. Set DUITKU_MERCHANT_CODE dan DUITKU_API_KEY di Vercel Dashboard.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { amount, paymentMethod: rawPaymentMethod } = body as {
      amount?: number
      method?: string
      paymentMethod?: string
    }
    // Channel code chosen in the in-app picker (e.g. 'SP', 'OV', 'BC') — optional.
    const selectedMethod =
      typeof rawPaymentMethod === 'string' && /^[A-Za-z0-9]{1,5}$/.test(rawPaymentMethod.trim())
        ? rawPaymentMethod.trim().toUpperCase()
        : undefined

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

    // Get user info for the invoice
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

    // Set expiry to match the Duitku invoice expiry
    const expiredAt = new Date()
    expiredAt.setMinutes(expiredAt.getMinutes() + EXPIRY_MINUTES)

    // ==================== STEP 1: Create deposit record (DB only, no external calls) ====================
    // IMPORTANT: Do NOT call the Duitku API inside db.$transaction().
    // Vercel serverless has ~5s timeout, and Prisma transactions have a default 5s timeout.

    const deposit = await db.deposit.create({
      data: {
        userId: authResult.user.id,
        amount,
        method: 'duitku',
        status: 'pending',
        expiredAt,
      },
    })

    const merchantOrderId = `DEPOSIT-${deposit.id}`

    await db.deposit.update({
      where: { id: deposit.id },
      data: { midtransOrderId: merchantOrderId }, // legacy column — stores our merchantOrderId
    })

    // Create a PENDING transaction record
    await db.transaction.create({
      data: {
        userId: authResult.user.id,
        type: 'deposit',
        amount,
        fee: 0,
        netAmount: amount,
        method: 'duitku',
        status: 'pending',
        description: `Top Up via Duitku — menunggu pembayaran (${merchantOrderId})`,
        refId: deposit.id,
      },
    })

    // ==================== STEP 2: Create Duitku invoice (OUTSIDE transaction) ====================
    const invoice = await createDuitkuInvoice({
      paymentAmount: amount,
      merchantOrderId,
      productDetails: `Top Up Saldo MartUp (${merchantOrderId})`,
      email: user.email,
      customerVaName: user.name,
      phoneNumber: user.phone || undefined,
      customerDetail: {
        firstName: user.name.slice(0, 50),
        email: user.email,
        phoneNumber: user.phone || undefined,
      },
      expiryPeriod: EXPIRY_MINUTES,
      // In-app channel selection: when set, the gateway skips its own
      // channel list and opens the chosen channel directly.
      paymentMethod: selectedMethod,
    })

    if (!invoice.success || !invoice.paymentUrl) {
      logger.error({ err: invoice, merchantOrderId }, 'Duitku invoice creation failed for deposit')
      // Update deposit status to failed
      await db.deposit.update({
        where: { id: deposit.id },
        data: { status: 'failed' },
      })
      return NextResponse.json(
        { success: false, error: friendlyGatewayError(invoice.statusMessage) },
        { status: 502 }
      )
    }

    // Step 3: Store the paymentUrl (snapToken column holds the Duitku payment URL)
    await db.deposit.update({
      where: { id: deposit.id },
      data: { snapToken: invoice.paymentUrl },
    })

    logBusinessEvent({
      event: 'DEPOSIT_DUITKU_CREATED',
      userId: authResult.user.id,
      details: {
        depositId: deposit.id,
        amount,
        merchantOrderId,
        isProduction: isDuitkuProduction(),
        paymentMethod: selectedMethod || '(gateway-side selection)',
      },
    })

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        depositId: deposit.id,
        amount,
        status: 'pending',
        paymentUrl: invoice.paymentUrl,
        reference: invoice.reference,
        merchantOrderId,
        expiredAt: expiredAt.toISOString(),
        message: 'Deposit Duitku dibuat. Anda akan diarahkan ke halaman pembayaran.',
      },
    }), { status: 201 })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Duitku Deposit Create POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
