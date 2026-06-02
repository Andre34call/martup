import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logger, logBusinessEvent } from '@/lib/logger'

// ==================== AUTO-CONFIRM SERVICE ORDERS CRON ====================
// Called by Vercel Cron or manually via POST.
// Auto-confirms service orders where the buyer hasn't responded within 3 days
// of the seller submitting proof of completion.
// Releases escrow funds to the seller (same logic as order-status.ts delivered status).

// ==================== CONFIGURATION ====================

const CRON_SECRET = process.env.CRON_SECRET || ''

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

// ==================== COMMISSION RATE HELPER ====================
// Mirrors the getCommissionRate function in order-status.ts

async function getCommissionRate(): Promise<number> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: 'platform_settings' } })
    if (row) {
      const settings = JSON.parse(row.value) as Record<string, number | boolean | string>
      if (typeof settings.commissionRate === 'number' && settings.commissionRate >= 0 && settings.commissionRate < 1) {
        return settings.commissionRate
      }
    }
  } catch {
    // Fallback to default
  }
  return 0.05
}

// ==================== CORE AUTO-CONFIRM LOGIC ====================

async function autoConfirmServiceOrders(): Promise<{
  confirmedCount: number
  orderIds: string[]
  errors: string[]
}> {
  const now = new Date()
  const errors: string[] = []

  // Find service orders where:
  // - status === 'shipped' (proof submitted)
  // - autoConfirmAt has passed
  // - buyerConfirmedAt is NULL (buyer hasn't manually confirmed)
  const pendingOrders = await db.order.findMany({
    where: {
      status: 'shipped',
      isServiceOrder: true,
      autoConfirmAt: { lt: now },
      buyerConfirmedAt: null,
    },
    include: {
      items: true,
      shipping: true,
      seller: {
        select: {
          id: true,
          userId: true,
          storeName: true,
          storeAvatar: true,
          commissionRate: true,
          wallet: true,
        },
      },
    },
  })

  if (pendingOrders.length === 0) {
    logger.info('No service orders to auto-confirm')
    return { confirmedCount: 0, orderIds: [], errors: [] }
  }

  logger.info({ count: pendingOrders.length }, 'Found service orders to auto-confirm')

  const confirmedOrderIds: string[] = []

  // Process each order in its own transaction
  for (const order of pendingOrders) {
    try {
      await db.$transaction(async (tx) => {
        // a. Update order status to delivered
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'delivered',
            deliveredAt: now,
            buyerConfirmedAt: now,
          },
        })

        // b. Update Shipping status if exists (service orders may not have shipping)
        if (order.shipping) {
          await tx.shipping.update({
            where: { id: order.shipping.id },
            data: {
              status: 'delivered',
              deliveredAt: now,
            },
          })
        }

        // c. Release escrow: move from pendingBalance to balance for seller
        // Same logic as order-status.ts delivered status
        const platformCommissionRate = await getCommissionRate()
        const sellerCommissionRate = Number(order.seller.commissionRate)
        const commissionRate = platformCommissionRate || sellerCommissionRate || 0.05
        const subtotal = Number(order.subtotal)
        const commissionAmount = Math.round(subtotal * commissionRate)
        const sellerEarnings = subtotal - commissionAmount

        // Find or create seller's wallet
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

        // Move from pendingBalance to balance (escrow release)
        const updatedWallet = await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: {
            pendingBalance: { decrement: Math.min(sellerEarnings, Number(sellerWallet.pendingBalance)) },
            balance: { increment: sellerEarnings },
          },
        })

        // Record wallet mutation for seller (credit)
        await tx.walletMutation.create({
          data: {
            walletId: sellerWallet.id,
            type: 'credit',
            amount: new Prisma.Decimal(sellerEarnings),
            balance: new Prisma.Decimal(Number(updatedWallet.balance)),
            description: `Pencairan dana pesanan ${order.orderNumber} - ${order.seller.storeName}`,
            refType: 'order',
            refId: order.id,
          },
        })

        // Record transaction for seller earnings
        await tx.transaction.create({
          data: {
            userId: order.seller.userId,
            type: 'payment',
            amount: new Prisma.Decimal(subtotal),
            fee: new Prisma.Decimal(commissionAmount),
            netAmount: new Prisma.Decimal(sellerEarnings),
            method: 'wallet',
            status: 'success',
            description: `Pencairan dana pesanan ${order.orderNumber}`,
            refId: order.id,
          },
        })

        // Record platform commission transaction
        if (commissionAmount > 0) {
          await tx.transaction.create({
            data: {
              userId: order.seller.userId,
              type: 'cashback',
              amount: new Prisma.Decimal(commissionAmount),
              fee: new Prisma.Decimal(0),
              netAmount: new Prisma.Decimal(commissionAmount),
              method: 'commission',
              status: 'success',
              description: `Komisi platform (${(commissionRate * 100).toFixed(1)}%) dari pesanan ${order.orderNumber}`,
              refId: order.orderNumber,
            },
          })
        }

        // Update seller total sales
        await tx.seller.update({
          where: { id: order.sellerId },
          data: { totalSales: { increment: 1 } },
        })

        // d. Create notification for buyer: "Pesanan Selesai Otomatis"
        await tx.notification.create({
          data: {
            userId: order.userId,
            title: 'Pesanan Jasa Selesai Otomatis',
            content: `Pesanan ${order.orderNumber} telah dikonfirmasi secara otomatis karena tidak ada konfirmasi dalam 3 hari. Dana penjual telah dicairkan.`,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })

        // e. Create notification for seller: "Dana Diterima"
        await tx.notification.create({
          data: {
            userId: order.seller.userId,
            title: 'Dana Pesanan Jasa Dicairkan',
            content: `Pembeli tidak mengkonfirmasi dalam 3 hari. Pesanan ${order.orderNumber} otomatis selesai dan dana telah dicairkan ke saldo Anda.`,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })
      })

      confirmedOrderIds.push(order.id)

      logBusinessEvent({
        event: 'service_order_auto_confirmed',
        userId: order.userId,
        details: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          sellerId: order.sellerId,
          reason: 'buyer_no_response_3d',
        },
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(
        { err: error, orderId: order.id, orderNumber: order.orderNumber },
        'Failed to auto-confirm service order'
      )
      errors.push(`Order ${order.orderNumber}: ${errorMsg}`)
    }
  }

  return {
    confirmedCount: confirmedOrderIds.length,
    orderIds: confirmedOrderIds,
    errors,
  }
}

// ==================== GET HANDLER (Vercel Cron) ====================

export async function GET(request: NextRequest) {
  try {
    // Security: Verify cron secret
    if (!verifyCronAuth(request)) {
      logger.warn({ path: '/api/cron/auto-confirm-service' }, 'Cron endpoint called without valid auth')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limit: max 1 call per minute
    if (!checkCronRateLimit('cron-auto-confirm-service', 1)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 1 call per minute.' },
        { status: 429 }
      )
    }

    const result = await autoConfirmServiceOrders()

    logger.info(
      { confirmedCount: result.confirmedCount, errorCount: result.errors.length },
      'Cron job completed: service orders auto-confirmed'
    )

    return NextResponse.json({
      success: true,
      data: {
        confirmedCount: result.confirmedCount,
        orderIds: result.orderIds,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Cron auto-confirm-service GET error')
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
      logger.warn({ path: '/api/cron/auto-confirm-service' }, 'Cron endpoint called without valid auth (POST)')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limit: max 1 call per minute
    if (!checkCronRateLimit('cron-auto-confirm-service', 1)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 1 call per minute.' },
        { status: 429 }
      )
    }

    const result = await autoConfirmServiceOrders()

    logger.info(
      { confirmedCount: result.confirmedCount, errorCount: result.errors.length, trigger: 'manual' },
      'Manual trigger completed: service orders auto-confirmed'
    )

    return NextResponse.json({
      success: true,
      data: {
        confirmedCount: result.confirmedCount,
        orderIds: result.orderIds,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Cron auto-confirm-service POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
