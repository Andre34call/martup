import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger, logBusinessEvent } from '@/lib/logger'

// ==================== AUTO-COMPLETE SHIPPED ORDERS CRON ====================
// Called by Vercel Cron every 6 hours, or manually via POST.
// Auto-completes shipped orders after 7 days and releases escrow to seller.

// ==================== CONFIGURATION ====================

const CRON_SECRET = process.env.CRON_SECRET || ''
const AUTO_COMPLETE_DAYS = parseInt(process.env.AUTO_COMPLETE_DAYS || '7', 10)

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

// ==================== CORE AUTO-COMPLETE LOGIC ====================

async function autoCompleteShippedOrders(): Promise<{
  completedCount: number
  orderIds: string[]
  errors: string[]
}> {
  const cutoffDate = new Date(Date.now() - AUTO_COMPLETE_DAYS * 24 * 60 * 60 * 1000)
  const errors: string[] = []

  // Find all shipped orders older than AUTO_COMPLETE_DAYS
  const shippedOrders = await db.order.findMany({
    where: {
      status: 'shipped',
      shippedAt: { lt: cutoffDate },
    },
    include: {
      shipping: true,
      seller: {
        select: {
          id: true,
          userId: true,
          storeName: true,
          commissionRate: true,
          wallet: true,
        },
      },
    },
  })

  if (shippedOrders.length === 0) {
    logger.info('No shipped orders to auto-complete')
    return { completedCount: 0, orderIds: [], errors: [] }
  }

  logger.info({ count: shippedOrders.length }, 'Found shipped orders to auto-complete')

  const completedOrderIds: string[] = []

  // Process each order in its own transaction
  for (const order of shippedOrders) {
    try {
      await db.$transaction(async (tx) => {
        // a. Update order status to delivered
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'delivered',
            deliveredAt: new Date(),
          },
        })

        // b. Update Shipping status to delivered
        if (order.shipping) {
          await tx.shipping.update({
            where: { id: order.shipping.id },
            data: {
              status: 'delivered',
              deliveredAt: new Date(),
            },
          })
        }

        // c. Release escrow: move from pendingBalance to availableBalance
        // IDEMPOTENCY: Check if escrow already released for this order
        const existingRelease = await tx.walletMutation.findFirst({
          where: {
            refType: 'order_release',
            refId: order.id,
            type: 'credit',
          },
        })

        if (!existingRelease) {
          const subtotal = Number(order.subtotal)
          const commissionRate = Number(order.seller.commissionRate)
          const commissionAmount = Math.round(subtotal * commissionRate)
          const sellerEarnings = subtotal - commissionAmount

          // Find or create the seller's wallet
          let sellerWallet = await tx.wallet.findUnique({
            where: { sellerId: order.sellerId },
          })

          if (!sellerWallet) {
            sellerWallet = await tx.wallet.create({
              data: {
                userId: order.seller.userId,
                sellerId: order.sellerId,
                balance: 0,
                holdBalance: 0,
                pendingBalance: 0,
              },
            })
          }

          // Move from pendingBalance to balance (availableBalance)
          const updatedWallet = await tx.wallet.update({
            where: { id: sellerWallet.id },
            data: {
              pendingBalance: { decrement: sellerEarnings },
              balance: { increment: sellerEarnings },
            },
          })

          const newBalance = Number(updatedWallet.balance)

          // Create wallet mutation record for escrow release
          await tx.walletMutation.create({
            data: {
              walletId: sellerWallet.id,
              type: 'credit',
              amount: sellerEarnings,
              balance: newBalance,
              description: `Dana diterima dari pesanan ${order.orderNumber} - ${order.seller.storeName}`,
              refType: 'order_release',
              refId: order.id,
            },
          })
        }

        // d. Create notification for buyer: "Pesanan Selesai"
        await tx.notification.create({
          data: {
            userId: order.userId,
            title: 'Pesanan Selesai',
            content: `Pesanan ${order.orderNumber} telah selesai. Terima kasih telah berbelanja!`,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })

        // e. Create notification for seller: "Dana Diterima"
        await tx.notification.create({
          data: {
            userId: order.seller.userId,
            title: 'Dana Diterima',
            content: `Dana dari pesanan ${order.orderNumber} telah diterima di saldo Anda`,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })
      })

      completedOrderIds.push(order.id)

      logBusinessEvent({
        event: 'order_auto_completed',
        userId: order.userId,
        details: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          sellerId: order.sellerId,
          reason: `shipped_${AUTO_COMPLETE_DAYS}d`,
        },
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(
        { err: error, orderId: order.id, orderNumber: order.orderNumber },
        'Failed to auto-complete shipped order'
      )
      errors.push(`Order ${order.orderNumber}: ${errorMsg}`)
    }
  }

  return {
    completedCount: completedOrderIds.length,
    orderIds: completedOrderIds,
    errors,
  }
}

// ==================== GET HANDLER (Vercel Cron) ====================

export async function GET(request: NextRequest) {
  try {
    // Security: Verify cron secret
    if (!verifyCronAuth(request)) {
      logger.warn({ path: '/api/cron/auto-complete' }, 'Cron endpoint called without valid auth')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limit: max 1 call per minute
    if (!checkCronRateLimit('cron-auto-complete', 1)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 1 call per minute.' },
        { status: 429 }
      )
    }

    const result = await autoCompleteShippedOrders()

    logger.info(
      { completedCount: result.completedCount, errorCount: result.errors.length },
      'Cron job completed: shipped orders auto-completed'
    )

    return NextResponse.json({
      success: true,
      data: {
        completedCount: result.completedCount,
        orderIds: result.orderIds,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Cron auto-complete GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== POST HANDLER (Manual Trigger) ====================

export async function POST(request: NextRequest) {
  try {
    // Security: Verify cron secret (same auth as GET)
    if (!verifyCronAuth(request)) {
      logger.warn({ path: '/api/cron/auto-complete' }, 'Cron endpoint called without valid auth (POST)')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limit: max 1 call per minute
    if (!checkCronRateLimit('cron-auto-complete', 1)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 1 call per minute.' },
        { status: 429 }
      )
    }

    const result = await autoCompleteShippedOrders()

    logger.info(
      { completedCount: result.completedCount, errorCount: result.errors.length, trigger: 'manual' },
      'Manual trigger completed: shipped orders auto-completed'
    )

    return NextResponse.json({
      success: true,
      data: {
        completedCount: result.completedCount,
        orderIds: result.orderIds,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Cron auto-complete POST error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
