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
 * NOTE: StockLog model is not yet implemented in the Prisma schema.
 * This function gracefully logs a warning and returns without error.
 */
export async function logStockChange(params: LogStockChangeParams): Promise<void> {
  // StockLog model does not exist yet — log and return gracefully
  logger.warn({ params }, 'StockLog model not implemented — stock change not recorded')
}

/**
 * Create a StockLog record within an existing Prisma transaction.
 * NOTE: StockLog model is not yet implemented in the Prisma schema.
 * This function gracefully logs a warning and returns without error.
 */
export async function logStockChangeInTx(
  _tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  params: LogStockChangeParams
): Promise<void> {
  // StockLog model does not exist yet — log and return gracefully
  logger.warn({ params }, 'StockLog model not implemented — stock change not recorded in transaction')
}
