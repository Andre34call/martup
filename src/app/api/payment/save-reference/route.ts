import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// POST /api/payment/save-reference
// Saves the payment reference (VA number, payment code, etc.) to the order
// Called from the frontend after Midtrans Snap popup returns a pending result
export async function POST(request: NextRequest) {
  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const { orderId, paymentReference } = body as {
      orderId?: string
      paymentReference?: string
    }

    if (!orderId || !paymentReference) {
      return NextResponse.json(
        { success: false, error: 'orderId and paymentReference are required' },
        { status: 400 }
      )
    }

    // Step 2: Find the order
    const order = await db.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Step 3: Verify order belongs to the authenticated user
    if (order.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only update your own orders' },
        { status: 403 }
      )
    }

    // Step 3.5: Verify order is in a state where saving payment reference makes sense
    // Only allow saving reference for orders that are pending/unpaid/pending payment
    const allowedStatuses = ['pending']
    const allowedPaymentStatuses = ['unpaid', 'pending']
    if (!allowedStatuses.includes(order.status) || !allowedPaymentStatuses.includes(order.paymentStatus)) {
      return NextResponse.json(
        { success: false, error: 'Tidak dapat menyimpan referensi pembayaran untuk pesanan dengan status ini' },
        { status: 400 }
      )
    }

    // Validate that paymentReference is valid JSON
    try {
      const parsed = JSON.parse(paymentReference)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Invalid format')
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Format referensi pembayaran tidak valid' },
        { status: 400 }
      )
    }

    // Step 4: Save the payment reference
    await db.order.update({
      where: { id: orderId },
      data: { paymentReference },
    })

    logger.info({
      orderId: order.id,
      orderNumber: order.orderNumber,
    }, 'Payment reference saved for order')

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Save Payment Reference POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
