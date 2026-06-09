// ==================== SELLER PAYOUT PROCESSOR ====================
// Shared logic for processing seller payouts after successful payment.
// Used by both wallet debit and Midtrans webhook notification handlers.
// Prevents divergent payout behavior between payment methods.

import { logger } from '@/lib/logger'

/**
 * Type for the Prisma transaction client passed into the payout function.
 * Uses `any` to avoid coupling to Prisma internals — the caller is responsible
 * for passing a valid transaction client from db.$transaction().
 */
type PrismaTx = any

interface SellerPayoutInput {
  /** Prisma transaction client (from db.$transaction callback) */
  tx: PrismaTx
  /** Database order ID */
  orderId: string
  /** Human-readable order number (e.g. ORD-20240101-ABC) */
  orderNumber: string
  /** Order subtotal (before shipping, discount, platform fee) */
  subtotal: number
  /** Seller's user ID (for wallet lookup) */
  sellerUserId: string
  /** Seller's store name (for notification description) */
  sellerStoreName: string
  /** Seller commission rate (e.g. 0.05 for 5%) */
  commissionRate: number
  /** Buyer's user ID (for notification) */
  buyerUserId: string
  /** Buyer's display name (for seller notification) */
  buyerName: string
  /** Order total amount (for notification description) */
  totalAmount: number
}

/**
 * Process seller payout after a successful order payment.
 * - Finds or creates seller wallet
 * - Credits seller's pendingBalance (escrow pattern)
 * - Creates wallet mutation record
 * - Creates commission transaction
 * - Creates buyer + seller notifications
 *
 * IDEMPOTENCY: Checks for existing wallet mutation before processing.
 * This function should be called INSIDE a db.$transaction() callback.
 */
export async function processSellerPayout(input: SellerPayoutInput): Promise<void> {
  const { tx, orderId, orderNumber, subtotal, sellerUserId, sellerStoreName, commissionRate, buyerUserId, buyerName, totalAmount } = input

  // IDEMPOTENCY: Check if seller already credited for this order
  const existingCredit = await tx.walletMutation.findFirst({
    where: { type: 'credit', refType: 'order', refId: orderId },
  })

  if (existingCredit) {
    logger.info({ orderNumber }, 'Seller payout already processed for order, skipping')
    return
  }

  const commissionAmount = Math.round(subtotal * commissionRate)
  const sellerEarnings = subtotal - commissionAmount

  // Find or create seller wallet
  let sellerWallet = await tx.wallet.findUnique({
    where: { userId: sellerUserId },
  })

  if (!sellerWallet) {
    sellerWallet = await tx.wallet.create({
      data: { userId: sellerUserId, balance: 0, holdBalance: 0, pendingBalance: 0 },
    })
  }

  // Credit seller's pending balance
  const updatedWallet = await tx.wallet.update({
    where: { id: sellerWallet.id },
    data: { pendingBalance: { increment: sellerEarnings } },
  })

  // Create wallet mutation
  await tx.walletMutation.create({
    data: {
      walletId: sellerWallet.id,
      type: 'credit',
      amount: sellerEarnings,
      balance: Number(updatedWallet.balance),
      description: `Pendapatan dari pesanan ${orderNumber} - ${sellerStoreName}`,
      refType: 'order',
      refId: orderId,
    },
  })

  // Create commission transaction
  if (commissionAmount > 0) {
    await tx.transaction.create({
      data: {
        userId: sellerUserId,
        type: 'cashback',
        amount: commissionAmount,
        fee: 0,
        netAmount: commissionAmount,
        method: 'commission',
        status: 'success',
        description: `Platform commission (${(commissionRate * 100).toFixed(1)}%) from order ${orderNumber}`,
        refId: orderNumber,
      },
    })
  }

  // Create buyer notification
  await tx.notification.create({
    data: {
      userId: buyerUserId,
      title: 'Pembayaran Berhasil',
      content: `Pembayaran untuk pesanan ${orderNumber} sebesar Rp ${totalAmount.toLocaleString('id-ID')} telah berhasil diproses.`,
      type: 'order',
      refType: 'order',
      refId: orderId,
    },
  })

  // Create seller notification
  await tx.notification.create({
    data: {
      userId: sellerUserId,
      title: 'Pesanan Baru Dibayar',
      content: `Pesanan ${orderNumber} dari ${buyerName} telah dibayar sebesar Rp ${totalAmount.toLocaleString('id-ID')}. Segera proses pesanan!`,
      type: 'order',
      refType: 'order',
      refId: orderId,
    },
  })
}
