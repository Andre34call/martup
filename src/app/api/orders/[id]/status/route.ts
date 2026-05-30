import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { updateOrderStatus } from '@/lib/order-status'
import { logger } from '@/lib/logger'

// ==================== PUT /api/orders/[id]/status ====================
// Update order status with full authentication, authorization, and transaction safety
// Business logic is delegated to the shared updateOrderStatus utility to avoid
// code duplication with the admin endpoint (previously caused SSRF via self-fetch).

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 2: Rate limit — 10 status updates per minute per user
    const rateLimitId = `order-status-put-${authResult.user.id}`
    if (!checkRateLimit(rateLimitId, 10)) {
      logger.warn({ userId: authResult.user.id }, 'Order status update rate limit exceeded')
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 10 status updates per minute.' },
        { status: 429 }
      )
    }

    // Step 3: Parse request body
    const { id } = await params
    const body = await request.json()
    const { status, cancelReason, trackingNumber } = body as {
      status?: string
      cancelReason?: string
      trackingNumber?: string
    }

    // Step 4: Delegate to shared business logic
    const result = await updateOrderStatus({
      orderId: id,
      status: status || '',
      cancelReason,
      trackingNumber,
      authUserId: authResult.user.id,
      authUserRole: authResult.user.role,
    })

    const duration = Date.now() - startTime
    logger.info({ duration }, 'PUT /api/orders/[id]/status completed')

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 500 }
      )
    }

    return NextResponse.json(
      serializeDecimal({ success: true, data: result.data })
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'PUT /api/orders/[id]/status error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
