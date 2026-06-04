import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

interface LogStockChangeParams {
  productId: string
  variantId?: string    // FK to ProductVariant, if stock change is for a specific variant
  type: 'order' | 'cancel' | 'adjustment' | 'restock' | 'return'
  quantity: number       // positive = increase, negative = decrease
  previousStock: number
  newStock: number
  reason?: string
  orderId?: string       // FK to Order, if stock change is related to an order
  createdBy?: string     // userId who made the change
}

/**
 * Create a StockLog record to track stock movements.
 * This is a fire-and-forget helper — errors are logged but don't throw.
 * Use this inside a transaction by passing `tx` if you want atomicity.
 */
export async function logStockChange(params: LogStockChangeParams): Promise<void> {
  try {
    await db.stockLog.create({
      data: {
        productId: params.productId,
        variantId: params.variantId || null,
        type: params.type,
        quantity: params.quantity,
        previousStock: params.previousStock,
        newStock: params.newStock,
        reason: params.reason || null,
        orderId: params.orderId || null,
        createdBy: params.createdBy || null,
      },
    })
  } catch (error) {
    // Stock logging should never break the main flow
    logger.error({ err: error, params }, 'Failed to create stock log entry')
  }
}

/**
 * Create a StockLog record within an existing Prisma transaction.
 * Use this when you need the stock log to be part of the same transaction.
 */
export async function logStockChangeInTx(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  params: LogStockChangeParams
): Promise<void> {
  await tx.stockLog.create({
    data: {
      productId: params.productId,
      variantId: params.variantId || null,
      type: params.type,
      quantity: params.quantity,
      previousStock: params.previousStock,
      newStock: params.newStock,
      reason: params.reason || null,
      orderId: params.orderId || null,
      createdBy: params.createdBy || null,
    },
  })
}
