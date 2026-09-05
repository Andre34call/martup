import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { paymentLimiter } from '@/lib/rate-limit'
import { serializeDecimal } from '@/lib/decimal-utils'
import { validateBody, paymentCreateSchema } from '@/lib/validations'
import { validateCsrfRequest } from '@/lib/csrf'
import {
  isDuitkuConfigured,
  isDuitkuProduction,
  createDuitkuInvoice,
  getDuitkuMerchantCode,
} from '@/lib/duitku'

import { logger } from '@/lib/logger'

// ==================== Duitku Configuration ====================
// Payment gateway: Duitku POP (window redirection flow).
// This route creates a Duitku invoice for an order and returns the paymentUrl.
// The frontend redirects the user to paymentUrl (Duitku payment page).

// Orders expire after 24 hours if unpaid
const ORDER_EXPIRY_HOURS = 24
// Reuse a stored invoice paymentUrl for up to 55 minutes (invoice expiry is 60 min)
const INVOICE_REUSE_MS = 55 * 60 * 1000

interface StoredInvoiceRef {
  merchantOrderId: string
  reference: string
  paymentUrl: string
  createdAt: string
}

export async function POST(request: NextRequest) {
  try {
    // Step 0: Check if Duitku is configured
    if (!isDuitkuConfigured()) {
      logger.error('DUITKU_MERCHANT_CODE / DUITKU_API_KEY not configured — cannot create payment')
      return NextResponse.json(
        {
          success: false,
          error: 'Sistem pembayaran belum terpasang. Silakan coba lagi nanti atau hubungi admin.',
        },
        { status: 503 }
      )
    }

    logger.info(
      { isProduction: isDuitkuProduction(), merchantCode: getDuitkuMerchantCode().substring(0, 2) + '***' },
      'Duitku payment mode'
    )

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

    // Allow 'unpaid' and 'pending' — user may retry payment while pending
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
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'cancelled',
            paymentStatus: 'expired',
            cancelledAt: new Date(),
            cancelReason: 'Order expired (unpaid for 24 hours)',
          },
        })

        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            })
          }
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              sold: { decrement: item.quantity },
            },
          })
        }

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

    // Step 8: Reuse a recently-created Duitku invoice if available (paymentUrl still valid)
    let storedInvoice: StoredInvoiceRef | null = null
    try {
      if (order.paymentReference) {
        const parsed = JSON.parse(order.paymentReference) as Partial<StoredInvoiceRef>
        if (parsed.paymentUrl && parsed.merchantOrderId && parsed.createdAt) {
          const age = Date.now() - new Date(parsed.createdAt).getTime()
          if (age >= 0 && age < INVOICE_REUSE_MS) {
            storedInvoice = parsed as StoredInvoiceRef
          }
        }
      }
    } catch {
      // paymentReference is not a stored invoice JSON — ignore
    }

    if (storedInvoice) {
      logger.info({ orderId: order.id, orderNumber: order.orderNumber }, 'Reusing existing Duitku invoice paymentUrl')
      return NextResponse.json(
        serializeDecimal({
          success: true,
          data: {
            paymentUrl: storedInvoice.paymentUrl,
            reference: storedInvoice.reference,
            merchantOrderId: storedInvoice.merchantOrderId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            reused: true,
          },
        })
      )
    }

    // Step 9: Build a unique merchantOrderId for this payment attempt.
    // Format: {orderNumber} for the first attempt, {orderNumber}-R2, -R3 ... for retries.
    // This avoids Duitku's same-orderId idempotency conflicts on re-payment attempts.
    const previousAttempts = await db.transaction.count({
      where: { type: 'payment', refId: order.orderNumber },
    })
    const merchantOrderId =
      previousAttempts === 0 ? order.orderNumber : `${order.orderNumber}-R${previousAttempts + 1}`

    const paymentAmount = Number(order.totalAmount)

    // Step 10: Build itemDetails — only when they sum EXACTLY to paymentAmount
    // (Duitku requires sum(itemDetails.price × qty) === paymentAmount)
    const adjustments =
      Number(order.discountAmount) + Number(order.taxAmount) + Number(order.platformFee)
    const itemDetails =
      adjustments === 0
        ? [
            ...order.items.map((item) => ({
              name: item.productName.slice(0, 50),
              price: Number(item.price),
              quantity: item.quantity,
            })),
            ...(Number(order.shippingCost) > 0
              ? [
                  {
                    name: 'Ongkos Kirim',
                    price: Number(order.shippingCost),
                    quantity: 1,
                  },
                ]
              : []),
          ]
        : undefined

    // Step 11: Create the Duitku invoice (OUTSIDE any db transaction — external API call)
    const invoice = await createDuitkuInvoice({
      paymentAmount,
      merchantOrderId,
      productDetails: `Pembayaran pesanan ${order.orderNumber} - MartUp`,
      email: order.user.email,
      customerVaName: order.user.name,
      phoneNumber: order.user.phone || undefined,
      itemDetails,
      customerDetail: {
        firstName: order.user.name.slice(0, 50),
        email: order.user.email,
        phoneNumber: order.user.phone || undefined,
      },
      expiryPeriod: 60, // minutes
    })

    if (!invoice.success || !invoice.paymentUrl) {
      logger.error(
        { err: invoice, orderId: order.id, orderNumber: order.orderNumber },
        'Duitku invoice creation failed'
      )
      return NextResponse.json(
        {
          success: false,
          error: invoice.statusMessage || 'Gagal membuat transaksi pembayaran. Silakan coba lagi.',
        },
        { status: 502 }
      )
    }

    // Step 12: Persist invoice info on the order + create/update Transaction record
    const invoiceRef: StoredInvoiceRef = {
      merchantOrderId,
      reference: invoice.reference || '',
      paymentUrl: invoice.paymentUrl,
      createdAt: new Date().toISOString(),
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentMethod: 'duitku',
          paymentStatus: 'pending',
          paymentReference: JSON.stringify(invoiceRef),
        },
      })

      const existingTransaction = await tx.transaction.findFirst({
        where: {
          userId: authResult.user.id,
          type: 'payment',
          refId: order.orderNumber,
          status: 'pending',
        },
      })

      if (existingTransaction) {
        await tx.transaction.update({
          where: { id: existingTransaction.id },
          data: {
            status: 'pending',
            method: 'duitku',
            description: `Pembayaran pesanan ${order.orderNumber} (${merchantOrderId})`,
          },
        })
      } else {
        await tx.transaction.create({
          data: {
            userId: authResult.user.id,
            type: 'payment',
            amount: order.totalAmount,
            fee: order.platformFee,
            netAmount: order.totalAmount,
            method: 'duitku',
            status: 'pending',
            description: `Pembayaran pesanan ${order.orderNumber} (${merchantOrderId})`,
            refId: order.orderNumber,
          },
        })
      }
    })

    logPaymentCreated(order, merchantOrderId)

    // Step 13: Return paymentUrl for the frontend to redirect to
    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: {
          paymentUrl: invoice.paymentUrl,
          reference: invoice.reference,
          merchantOrderId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          reused: false,
        },
      })
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'Payment Create POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

function logPaymentCreated(
  order: { id: string; orderNumber: string; totalAmount: unknown },
  merchantOrderId: string
) {
  logger.info(
    {
      event: 'PAYMENT_DUITKU_INVOICE_CREATED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      merchantOrderId,
      amount: Number(order.totalAmount),
    },
    'Duitku invoice created for order'
  )
}
