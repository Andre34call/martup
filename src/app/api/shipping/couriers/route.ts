import { NextResponse } from 'next/server'
import { getSupportedCouriers } from '@/lib/shipping-calculator'
import { logger } from '@/lib/logger'

// ==================== SHIPPING COURIERS API ====================
// GET /api/shipping/couriers
// List all supported couriers and their services (public endpoint)

export async function GET() {
  try {
    const couriers = getSupportedCouriers()

    logger.info(
      { component: 'shipping', courierCount: couriers.length },
      'Couriers list requested'
    )

    return NextResponse.json({
      success: true,
      data: couriers,
    })
  } catch (error) {
    logger.error(
      { component: 'shipping', err: error },
      'Failed to list couriers'
    )
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve courier list' },
      { status: 500 }
    )
  }
}
