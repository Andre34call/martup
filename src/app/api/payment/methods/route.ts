import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { getDuitkuPaymentMethods, groupDuitkuMethods, isDuitkuConfigured } from '@/lib/duitku'
import { logger } from '@/lib/logger'

// ==================== PAYMENT METHOD LIST ====================
// GET /api/payment/methods?amount=150000
//
// Returns the payment channels that are ACTIVE for this merchant and
// eligible for the given amount (Duitku getpaymentmethod API), grouped
// into categories (QRIS / E-Wallet / Virtual Account / Card / Retail)
// so the in-app channel picker can render them directly.
//
// The client passes the chosen code back to /api/payment/create (or
// /api/deposit/duitku/create) as `paymentMethod` — Duitku then skips its
// own channel-selection page and goes straight to the chosen channel.

const methodsLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:paymethod:' })

// In-memory cache (60s) — shields Duitku from rapid re-fetches on re-render.
// Serverless instances are ephemeral, so this is just a cheap dedupe layer.
const CACHE_TTL_MS = 60_000
const cache = new Map<number, { at: number; groups: ReturnType<typeof groupDuitkuMethods> }>()

export async function GET(request: NextRequest) {
  try {
    // Authentication required — the picker only appears in authenticated flows
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const rateLimitResult = await methodsLimiter.check(`paymethods-${authResult.user.id}`)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi sebentar.' },
        { status: 429 }
      )
    }

    if (!isDuitkuConfigured()) {
      return NextResponse.json({
        success: true,
        data: { configured: false, groups: [] },
      })
    }

    const { searchParams } = new URL(request.url)
    const rawAmount = Number(searchParams.get('amount'))

    if (!Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 100_000_000_000) {
      return NextResponse.json(
        { success: false, error: 'Parameter amount tidak valid' },
        { status: 400 }
      )
    }

    const amount = Math.round(rawAmount)

    const cached = cache.get(amount)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        data: { configured: true, groups: cached.groups },
      })
    }

    const methods = await getDuitkuPaymentMethods(amount)

    if (methods.length === 0) {
      logger.warn({ amount }, 'Duitku payment method list empty or unreachable')
      return NextResponse.json({
        success: true,
        data: { configured: true, groups: [], unavailable: true },
      })
    }

    const groups = groupDuitkuMethods(methods)
    cache.set(amount, { at: Date.now(), groups })

    return NextResponse.json({
      success: true,
      data: { configured: true, groups },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Payment methods GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
