import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'

const shippingCalcLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20, keyPrefix: 'rl:shipping:calc:' })
import { calculateShippingRates, isValidCourier, getValidCourierNames } from '@/lib/shipping-calculator'
import { logger, logBusinessEvent } from '@/lib/logger'

// ==================== SHIPPING CALCULATE API ====================
// POST /api/shipping/calculate
// Calculate shipping rates from origin to destination based on weight

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth required
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Log RajaOngkir configuration status
    const { isRajaOngkirConfigured } = await import('@/lib/rajaongkir').catch(() => ({ isRajaOngkirConfigured: () => false }))
    logger.info({ component: 'shipping-api', rajaongkir: isRajaOngkirConfigured() }, 'Shipping calculation requested')

    // Rate limit: 20 req/min per user
    const rateLimit = await shippingCalcLimiter.check(authResult.user.id)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      logger.warn(
        { component: 'shipping', userId: authResult.user.id },
        'Shipping calculate rate limit exceeded'
      )
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    // Parse request body
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { originCity, destinationCity, weight, courier } = body as {
      originCity?: string
      destinationCity?: string
      weight?: number
      courier?: string
    }

    // Validate originCity
    if (!originCity || typeof originCity !== 'string') {
      return NextResponse.json(
        { success: false, error: 'originCity is required' },
        { status: 400 }
      )
    }
    if (originCity.length > 100) {
      return NextResponse.json(
        { success: false, error: 'originCity must be at most 100 characters' },
        { status: 400 }
      )
    }

    // Validate destinationCity
    if (!destinationCity || typeof destinationCity !== 'string') {
      return NextResponse.json(
        { success: false, error: 'destinationCity is required' },
        { status: 400 }
      )
    }
    if (destinationCity.length > 100) {
      return NextResponse.json(
        { success: false, error: 'destinationCity must be at most 100 characters' },
        { status: 400 }
      )
    }

    // Validate weight
    if (weight === undefined || weight === null || typeof weight !== 'number') {
      return NextResponse.json(
        { success: false, error: 'weight is required and must be a number' },
        { status: 400 }
      )
    }
    if (weight <= 0) {
      return NextResponse.json(
        { success: false, error: 'weight must be a positive number' },
        { status: 400 }
      )
    }
    if (weight > 100000) {
      return NextResponse.json(
        { success: false, error: 'weight must be at most 100,000 grams (100kg)' },
        { status: 400 }
      )
    }

    // Validate courier if provided
    if (courier !== undefined && courier !== null) {
      if (typeof courier !== 'string') {
        return NextResponse.json(
          { success: false, error: 'courier must be a string' },
          { status: 400 }
        )
      }
      if (!isValidCourier(courier)) {
        return NextResponse.json(
          { success: false, error: `Invalid courier. Valid couriers: ${getValidCourierNames().join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Calculate shipping rates
    const rates = await calculateShippingRates({
      originCity: originCity.trim(),
      destinationCity: destinationCity.trim(),
      weight: Math.round(weight),
      courier: courier?.trim(),
    })

    logBusinessEvent({
      event: 'shipping_rates_requested',
      userId: authResult.user.id,
      details: {
        originCity: originCity.trim(),
        destinationCity: destinationCity.trim(),
        weight: Math.round(weight),
        courier: courier?.trim() || 'all',
        rateCount: rates.length,
        duration: Date.now() - startTime,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        rates,
        origin: originCity.trim(),
        destination: destinationCity.trim(),
        weight: Math.round(weight),
      },
    })
  } catch (error) {
    logger.error(
      { component: 'shipping', err: error, duration: Date.now() - startTime },
      'Shipping calculate error'
    )
    return NextResponse.json(
      { success: false, error: 'Failed to calculate shipping rates' },
      { status: 500 }
    )
  }
}
