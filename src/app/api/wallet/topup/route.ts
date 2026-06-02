import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'

// ==================== WALLET TOP UP ====================
// SECURITY: Requires authentication + ownership verification
// Creates a PENDING deposit — must be verified by payment gateway or admin
// BEFORE balance is credited. No auto-approve.

const VALID_METHODS = ['bank_transfer', 'gopay', 'ovo', 'dana', 'shopeepay', 'linkaja']

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Transfer Bank',
  gopay: 'GoPay',
  ovo: 'OVO',
  dana: 'DANA',
  shopeepay: 'ShopeePay',
  linkaja: 'LinkAja',
}

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
    const { amount, method, senderName } = body as { amount?: number; method?: string; senderName?: string }

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
    if (!method || !VALID_METHODS.includes(method)) {
      return NextResponse.json(
        { success: false, error: `Metode pembayaran tidak valid. Pilih: ${VALID_METHODS.join(', ')}` },
        { status: 400 }
      )
    }

    // Get MartUp bank accounts for destination info
    let destinationAccount: string | null = null
    try {
      const settingsRecord = await db.platformSetting.findUnique({
        where: { key: 'platform_settings' },
      })
      if (settingsRecord) {
        const settings = JSON.parse(settingsRecord.value)
        const bankAccounts = JSON.parse(settings.martupBankAccounts || '[]')
        // Find matching destination based on method
        if (method === 'bank_transfer' && bankAccounts.length > 0) {
          // Find first bank account
          const bankAcc = bankAccounts.find((a: Record<string, unknown>) => a.type !== 'ewallet')
          if (bankAcc) {
            destinationAccount = JSON.stringify(bankAcc)
          }
        } else if (method !== 'bank_transfer' && bankAccounts.length > 0) {
          // Find matching e-wallet
          const methodToName: Record<string, string[]> = {
            gopay: ['GoPay', 'gopay'],
            ovo: ['OVO', 'ovo'],
            dana: ['DANA', 'dana'],
            shopeepay: ['ShopeePay', 'shopeepay'],
            linkaja: ['LinkAja', 'linkaja'],
          }
          const names = methodToName[method] || []
          const ewalletAcc = bankAccounts.find((a: Record<string, unknown>) =>
            a.type === 'ewallet' && names.some(n => String(a.bankName || '').toLowerCase().includes(n.toLowerCase()))
          )
          if (ewalletAcc) {
            destinationAccount = JSON.stringify(ewalletAcc)
          }
        }
      }
    } catch {
      // Non-critical — deposit can still be created without destination
      logger.warn('Failed to fetch platform settings for deposit destination')
    }

    // Set expiry to 24 hours from now
    const expiredAt = new Date()
    expiredAt.setHours(expiredAt.getHours() + 24)

    // Create PENDING deposit record — NO balance credit until payment verified
    const deposit = await db.deposit.create({
      data: {
        userId: authResult.user.id,
        amount,
        method,
        status: 'pending',
        destinationAccount,
        senderName: senderName || null,
        expiredAt,
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
        status: 'pending',
        description: `Top up via ${METHOD_LABELS[method] || method} — menunggu pembayaran`,
        refId: deposit.id,
      },
    })

    logBusinessEvent({
      event: 'DEPOSIT_REQUESTED',
      userId: authResult.user.id,
      details: { depositId: deposit.id, amount, method },
    })

    // Return deposit info with destination account for payment instructions
    let destinationInfo = null
    if (destinationAccount) {
      try {
        destinationInfo = JSON.parse(destinationAccount)
      } catch {
        destinationInfo = null
      }
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        depositId: deposit.id,
        amount,
        method,
        methodLabel: METHOD_LABELS[method] || method,
        status: 'pending',
        destinationAccount: destinationInfo,
        expiredAt: expiredAt.toISOString(),
        message: 'Deposit dibuat. Silakan selesaikan pembayaran sebelum kadaluarsa.',
      },
    }), { status: 201 })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Top up error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
