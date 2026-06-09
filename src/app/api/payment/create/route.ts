import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { paymentLimiter } from '@/lib/rate-limit'
import { serializeDecimal } from '@/lib/decimal-utils'
import { validateBody, paymentCreateSchema } from '@/lib/validations'
import { validateCsrfRequest } from '@/lib/csrf'

import { logger } from '@/lib/logger'
// ==================== Midtrans Configuration ====================
// IMPORTANT: Read env vars at request time (not module level) to avoid stale values
// in Vercel serverless cold starts. We use getter functions instead.

function getMidtransServerKey(): string {
  return process.env.MIDTRANS_SERVER_KEY || ''
}

function isMidtransProduction(): boolean {
  // Priority 1: Explicit env var flags
  if (process.env.MIDTRANS_IS_PRODUCTION === 'true' || process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true') {
    return true
  }
  // Priority 2: Auto-detect from server key prefix
  // Sandbox keys start with 'SB-' — if the key has this prefix, force sandbox mode
  const key = getMidtransServerKey()
  if (key.startsWith('SB-')) {
    return false // Sandbox key detected
  }
  // Default: production mode if key exists but no SB- prefix
  // (This is a safe default — production keys don't have a specific prefix)
  return !!key // If key exists without SB- prefix, assume production
}

function getSnapUrl(): string {
  return isMidtransProduction()
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions'
}

function getMidtransApiBaseUrl(): string {
  return isMidtransProduction()
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com'
}

// Orders expire after 24 hours if unpaid
const ORDER_EXPIRY_HOURS = 24

// Get base URL for Midtrans callbacks (VERCEL_URL in production, localhost for dev)
function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL !== 'http://localhost:3000') return process.env.NEXTAUTH_URL
  return process.env.NEXTAUTH_URL || 'http://localhost:3000'
}

// ==================== POST /api/payment/create ====================
// Create a Midtrans Snap transaction token for an order

export async function POST(request: NextRequest) {
  try {
    // Step 0: Check if Midtrans is configured
    const MIDTRANS_SERVER_KEY = getMidtransServerKey()
    if (!MIDTRANS_SERVER_KEY) {
      logger.error('MIDTRANS_SERVER_KEY not configured — cannot create payment')
      return NextResponse.json(
        {
          success: false,
          error: 'Pembayaran Midtrans belum dikonfigurasi. Set MIDTRANS_SERVER_KEY dan NEXT_PUBLIC_MIDTRANS_CLIENT_KEY di Vercel Dashboard → Settings → Environment Variables.',
        },
        { status: 503 }
      )
    }

    // Log Midtrans mode for debugging
    const isProduction = isMidtransProduction()
    logger.info({ isProduction, keyPrefix: MIDTRANS_SERVER_KEY.substring(0, 3) }, 'Midtrans payment mode')

    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 1.5: CSRF protection
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json(
        { success: false, error: 'CSRF validation failed. Silakan refresh halaman dan coba lagi.' },
        { status: 403 }
      )
    }

    // Step 2: Rate limit — 5 payment creation requests per minute (distributed)
    const rateLimitId = `payment-create-${authResult.user.id}`
    const rateLimitResult = await paymentLimiter.check(rateLimitId)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 5 payment requests per minute.' },
        { status: 429 }
      )
    }

    // Step 3: Parse and validate request body
    const body = await request.json()

    // Zod validation
    const validation = validateBody(paymentCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { orderId } = validation.data

    // Step 4: Find the order with items and user details
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Step 5: Verify order belongs to the authenticated user
    if (order.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only pay for your own orders' },
        { status: 403 }
      )
    }

    // Step 6: Verify order is in a payable state
    if (order.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Order cannot be paid. Current status: ${order.status}` },
        { status: 400 }
      )
    }

    // Allow both 'unpaid' and 'pending' — Midtrans may send a 'pending' notification
    // when a Snap transaction is created, changing paymentStatus from 'unpaid' to 'pending'.
    // The user should still be able to re-attempt payment in this state.
    if (order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Order payment status is already: ${order.paymentStatus}` },
        { status: 400 }
      )
    }

    // Step 7: Verify order hasn't expired (24h for unpaid orders)
    const orderAge = Date.now() - order.createdAt.getTime()
    const expiryMs = ORDER_EXPIRY_HOURS * 60 * 60 * 1000
    if (orderAge > expiryMs) {
      // Auto-cancel the expired order and restore stock
      await db.$transaction(async (tx) => {
        // Update order status
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'cancelled',
            paymentStatus: 'expired',
            cancelledAt: new Date(),
            cancelReason: 'Order expired (unpaid for 24 hours)',
          },
        })

        // Restore product stock for all order items
        for (const item of order.items) {
          // Restore variant stock if variantId exists
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            })
          }
          // Restore product stock and decrement sold count
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              sold: { decrement: item.quantity },
            },
          })
        }

        // Create notification for buyer
        await tx.notification.create({
          data: {
            userId: order.userId,
            title: 'Pesanan Dibatalkan',
            content: `Pesanan ${order.orderNumber} dibatalkan otomatis karena pembayaran tidak diterima dalam 24 jam`,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })
      })

      logger.info(
        { orderId: order.id, orderNumber: order.orderNumber },
        'Auto-cancelled expired order during payment attempt'
      )

      return NextResponse.json(
        { success: false, error: 'Order has expired. Unpaid orders are automatically cancelled after 24 hours.' },
        { status: 400 }
      )
    }

    // Step 9: Call Midtrans Snap API to create a transaction token
    // Note: authString is defined early so it can also be used in Step 8.5 for token reuse check
    const authString = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64')
    const SNAP_URL = getSnapUrl()
    const midtransApiBaseUrl = getMidtransApiBaseUrl()

    // Step 8: Check if a pending transaction already exists for this order
    const existingTransaction = await db.transaction.findFirst({
      where: {
        userId: authResult.user.id,
        type: 'payment',
        refId: order.orderNumber,
        status: 'pending',
      },
    })

    // Step 8.5: Reuse existing Snap token if there's a valid pending transaction
    // and the order was created recently (within 2 hours — Snap token validity)
    // This prevents creating a new VA number each time the user clicks "Bayar"
    if (existingTransaction && existingTransaction.createdAt) {
      const tokenAge = Date.now() - new Date(existingTransaction.createdAt).getTime()
      const maxSnapTokenAge = 2 * 60 * 60 * 1000 // 2 hours
      if (tokenAge < maxSnapTokenAge) {
        // Try to get the existing Snap token from Midtrans
        // Use the Midtrans transaction status API to check if token is still valid
        const statusUrl = `${midtransApiBaseUrl}/v2/${order.orderNumber}/status`

        try {
          const statusResponse = await fetch(statusUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Basic ${authString}`,
            },
          })

          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            // If the transaction is still pending and has a token, reuse it
            if (statusData.transaction_status === 'pending' && statusData.token) {
              logger.info({
                orderId: order.id,
                orderNumber: order.orderNumber,
              }, 'Reusing existing Snap token for order')

              return NextResponse.json(
                serializeDecimal({
                  success: true,
                  data: {
                    token: statusData.token,
                    redirectUrl: statusData.redirect_url,
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    totalAmount: order.totalAmount,
                    reused: true,
                  },
                })
              )
            }
          }
        } catch (statusErr) {
          // If status check fails, proceed to create a new token
          logger.warn({ err: statusErr, orderId: order.id }, 'Failed to check existing Snap token status, creating new one')
        }
      }
    }

    // Step 10: Build Midtrans Snap payload
    // IMPORTANT: gross_amount MUST exactly equal sum(item_details.price × quantity)
    // Otherwise Midtrans rejects the transaction
    const baseUrl = getBaseUrl()

    // Warn if notification_url uses localhost (Midtrans can't reach localhost)
    if (baseUrl.includes('localhost')) {
      logger.warn(
        'Midtrans notification_url uses localhost — payment callbacks will NOT work in development. Deploy to Vercel for full payment flow.'
      )
    }

    const midtransPayload: Record<string, unknown> = {
      transaction_details: {
        order_id: order.orderNumber,
        gross_amount: Number(order.totalAmount),
      },
      item_details: [
        ...order.items.map((item) => ({
          id: item.productId,
          price: Number(item.price),
          quantity: item.quantity,
          name: item.productName.substring(0, 50),
        })),
        {
          id: 'shipping',
          price: Number(order.shippingCost),
          quantity: 1,
          name: 'Ongkos Kirim',
        },
        ...(Number(order.discountAmount) > 0
          ? [
              {
                id: 'discount',
                price: -Number(order.discountAmount),
                quantity: 1,
                name: 'Diskon',
              },
            ]
          : []),
        ...(Number(order.taxAmount) > 0
          ? [
              {
                id: 'tax',
                price: Number(order.taxAmount),
                quantity: 1,
                name: 'Pajak',
              },
            ]
          : []),
        ...(Number(order.platformFee) > 0
          ? [
              {
                id: 'platform-fee',
                price: Number(order.platformFee),
                quantity: 1,
                name: 'Biaya Platform',
              },
            ]
          : []),
      ],
      customer_details: {
        first_name: order.user.name,
        email: order.user.email,
        phone: order.user.phone || undefined,
      },
    }

    // Only include callbacks with a publicly accessible URL
    // Midtrans can't reach localhost, so omit callback URLs in development
    if (!baseUrl.includes('localhost')) {
      midtransPayload.callbacks = {
        finish: `${baseUrl}/orders?payment=finish`,
        error: `${baseUrl}/orders?payment=error`,
        pending: `${baseUrl}/orders?payment=pending`,
      }
    }
    // notification_url is set via Midtrans dashboard settings, not in the Snap payload
    // This ensures it's always correct regardless of the request origin
    // Set it in: Midtrans Dashboard → Settings → Payment → Payment Notification URL

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
      logger.error({ err: snapData }, 'Midtrans Snap API error')
      return NextResponse.json(
        {
          success: false,
          error: snapData.error_messages?.[0] || 'Failed to create payment transaction with Midtrans',
        },
        { status: 502 }
      )
    }

    const { token, redirect_url } = snapData

    // Step 12: Create or update a Transaction record
    if (existingTransaction) {
      // Update existing pending transaction with new token reference
      await db.transaction.update({
        where: { id: existingTransaction.id },
        data: {
          status: 'pending',
          description: `Payment for order ${order.orderNumber} - Midtrans Snap token created`,
        },
      })
    } else {
      await db.transaction.create({
        data: {
          userId: authResult.user.id,
          type: 'payment',
          amount: order.totalAmount,
          fee: order.platformFee,
          netAmount: order.totalAmount,
          method: 'midtrans',
          status: 'pending',
          description: `Payment for order ${order.orderNumber}`,
          refId: order.orderNumber,
        },
      })
    }

    // Step 11: Return the Snap token and redirect URL
    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: {
          token,
          redirectUrl: redirect_url,
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
        },
      })
    )
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Payment Create POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
