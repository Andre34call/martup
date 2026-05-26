import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger, logBusinessEvent } from '@/lib/logger'

// ==================== AUTO-COMPLETE-STUCK (REMINDER) CRON ====================
// Called by Vercel Cron daily at 9am, or manually via POST.
// Finds orders stuck in 'processing' for more than 3 days and
// sends a reminder notification to the seller to ship.
// Does NOT auto-cancel or change status — just reminds.

// ==================== CONFIGURATION ====================

const CRON_SECRET = process.env.CRON_SECRET || ''
const STUCK_PROCESSING_DAYS = parseInt(process.env.STUCK_PROCESSING_DAYS || '3', 10)

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

// ==================== CORE STUCK-PROCESSING REMINDER LOGIC ====================

async function remindStuckProcessingOrders(): Promise<{
  remindedCount: number
  orderIds: string[]
  errors: string[]
}> {
  const cutoffDate = new Date(Date.now() - STUCK_PROCESSING_DAYS * 24 * 60 * 60 * 1000)
  const errors: string[] = []

  // Find all orders stuck in 'processing' for more than STUCK_PROCESSING_DAYS
  const stuckOrders = await db.order.findMany({
    where: {
      status: 'processing',
      updatedAt: { lt: cutoffDate },
    },
    include: {
      seller: {
        select: {
          id: true,
          userId: true,
          storeName: true,
        },
      },
    },
  })

  if (stuckOrders.length === 0) {
    logger.info('No stuck processing orders to remind')
    return { remindedCount: 0, orderIds: [], errors: [] }
  }

  logger.info({ count: stuckOrders.length }, 'Found stuck processing orders to remind')

  const remindedOrderIds: string[] = []

  // Process each order in its own transaction
  for (const order of stuckOrders) {
    try {
      await db.$transaction(async (tx) => {
        // Create reminder notification for seller
        await tx.notification.create({
          data: {
            userId: order.seller.userId,
            title: 'Segera Kirim Pesanan',
            content: `Pesanan ${order.orderNumber} sudah ${STUCK_PROCESSING_DAYS} hari dalam status diproses. Segera kirim pesanan Anda!`,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })
      })

      remindedOrderIds.push(order.id)

      logBusinessEvent({
        event: 'stuck_processing_reminder',
        userId: order.seller.userId,
        details: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          sellerId: order.sellerId,
          daysInProcessing: STUCK_PROCESSING_DAYS,
        },
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error(
        { err: error, orderId: order.id, orderNumber: order.orderNumber },
        'Failed to send stuck processing reminder'
      )
      errors.push(`Order ${order.orderNumber}: ${errorMsg}`)
    }
  }

  return {
    remindedCount: remindedOrderIds.length,
    orderIds: remindedOrderIds,
    errors,
  }
}

// ==================== GET HANDLER (Vercel Cron) ====================

export async function GET(request: NextRequest) {
  try {
    // Security: Verify cron secret
    if (!verifyCronAuth(request)) {
      logger.warn({ path: '/api/cron/auto-complete-stuck' }, 'Cron endpoint called without valid auth')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limit: max 1 call per minute
    if (!checkCronRateLimit('cron-auto-complete-stuck', 1)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 1 call per minute.' },
        { status: 429 }
      )
    }

    const result = await remindStuckProcessingOrders()

    logger.info(
      { remindedCount: result.remindedCount, errorCount: result.errors.length },
      'Cron job completed: stuck processing reminders sent'
    )

    return NextResponse.json({
      success: true,
      data: {
        remindedCount: result.remindedCount,
        orderIds: result.orderIds,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Cron auto-complete-stuck GET error')
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
      logger.warn({ path: '/api/cron/auto-complete-stuck' }, 'Cron endpoint called without valid auth (POST)')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limit: max 1 call per minute
    if (!checkCronRateLimit('cron-auto-complete-stuck', 1)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 1 call per minute.' },
        { status: 429 }
      )
    }

    const result = await remindStuckProcessingOrders()

    logger.info(
      { remindedCount: result.remindedCount, errorCount: result.errors.length, trigger: 'manual' },
      'Manual trigger completed: stuck processing reminders sent'
    )

    return NextResponse.json({
      success: true,
      data: {
        remindedCount: result.remindedCount,
        orderIds: result.orderIds,
        ...(result.errors.length > 0 ? { errors: result.errors } : {}),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Cron auto-complete-stuck POST error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
