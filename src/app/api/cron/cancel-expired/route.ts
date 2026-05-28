import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger, logBusinessEvent } from '@/lib/logger'

// ==================== AUTO-CANCEL EXPIRED ORDERS CRON ====================
// Called by Vercel Cron every hour, or manually via POST.
// Cancels orders that have been unpaid for more than 24 hours and restores stock.

// ==================== CONFIGURATION ====================

const CRON_SECRET = process.env.CRON_SECRET || ''
const ORDER_EXPIRY_HOURS = 24

// ==================== RATE LIMIT (in-memory, 1 call per minute) ====================

const rateLimitMap = new Map<string, { count: number; lastReset: number }>()

function checkCronRateLimit(identifier: string, maxRequests: number = 1): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry || now - entry.lastReset > 60_000) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}

// ==================== AUTH VERIFICATION ====================

function verifyCronAuth(request: NextRequest): boolean {
  if (!CRON_SECRET) {
    logger.error('CRON_SECRET environment variable is not set — cron endpoint is disabled')
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  if (!token) return false

  // Timing-safe comparison
  const expected = CRON_SECRET
  if (token.length !== expected.length) return false

  let mismatch = 0
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

// ==================== CORE CANCEL LOGIC ====================

async function cancelExpiredOrders(): Promise<{
  cancelledCount: number
  orderIds: string[]
  errors: string[]
}> {
  const expiryDate = new Date(Date.now() - ORDER_EXPIRY_HOURS * 60 * 60 * 1000)
  const errors: string[] = []

  // Find all expired orders
  const expiredOrders = await db.order.findMany({
    where: {
      status: 'pending',
      paymentStatus: 'unpaid',
      createdAt: { lt: expiryDate },
    },
    include: {
      items: true,
    },
  })

  if (expiredOrders.length === 0) {
    logger.info('No expired orders to cancel')
    return { cancelledCount: 0, orderIds: [], errors: [] }
  }

  logger.info({ count: expiredOrders.length }, 'Found expired orders to cancel')

  const cancelledOrderIds: string[] = []

  // Process each order in its own transaction
  for (const order of expiredOrders) {
    try {
      await db.$transaction(async (tx) => {
        // a. Update order status
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'cancelled',
            paymentStatus: 'expired',
            cancelledAt: new Date(),
            cancelReason:
              'Otomatis dibatalkan: pembayaran tidak diterima dalam 24 jam',
          },
        })

        // b. Restore product stock for all order items
        for (const item of order.items) {
          // c. Restore variant stock if variantId exists
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

        // d. Create notification for buyer
        await tx.notification.create({
          data: {
            userId: order.userId,
            title: 'Pesanan Dibatalkan',
            content: `Pesanan ${order.orderNumber} dibatalkan otomatis karena pembayaran tidak diterima`,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })
      })

      cancelledOrderIds.push(order.id)

      logBusinessEvent({
        event: 'order_auto_cancelled',
        userId: order.userId,
        details: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: 'unpaid_24h',
        },
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(
        { err: error, orderId: order.id, orderNumber: order.orderNumber },
        'Failed to cancel expired order'
      )
      errors.push(`Order ${order.orderNumber}: ${errorMsg}`)
    }
  }

  return {
    cancelledCount: cancelledOrderIds.length,
    orderIds: cancelledOrderIds,
    errors,
  }
}

// ==================== GET HANDLER (Vercel Cron) ====================

export async function GET(request: NextRequest) {
  try {
    // Security: Verify cron secret
    if (!verifyCronAuth(request)) {
      logger.warn({ path: '/api/cron/cancel-expired' }, 'Cron endpoint called without valid auth')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limit: max 1 call per minute
    if (!checkCronRateLimit('cron-cancel-expired', 1)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 1 call per minute.' },
        { status: 429 }
      )
    }

    const result = await cancelExpiredOrders()

    logger.info(
      { cancelledCount: result.cancelledCount, errorCount: result.errors.length },
      'Cron job completed: expired orders cancelled'
    )

    return NextResponse.json({
      success: true,
      data: {
        cancelledCount: result.cancelledCount,
        orderIds: result.orderIds,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      },
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Cron cancel-expired GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== POST HANDLER (Manual Trigger) ====================

export async function POST(request: NextRequest) {
  try {
    // Security: Verify cron secret (same auth as GET)
    if (!verifyCronAuth(request)) {
      logger.warn({ path: '/api/cron/cancel-expired' }, 'Cron endpoint called without valid auth (POST)')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limit: max 1 call per minute
    if (!checkCronRateLimit('cron-cancel-expired', 1)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 1 call per minute.' },
        { status: 429 }
      )
    }

    const result = await cancelExpiredOrders()

    logger.info(
      { cancelledCount: result.cancelledCount, errorCount: result.errors.length, trigger: 'manual' },
      'Manual trigger completed: expired orders cancelled'
    )

    return NextResponse.json({
      success: true,
      data: {
        cancelledCount: result.cancelledCount,
        orderIds: result.orderIds,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      },
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Cron cancel-expired POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
