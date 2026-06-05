import { PrismaClient } from '@prisma/client'
import { PLATFORM_FEE_RATE } from '@/lib/constants'

/**
 * Process seller payout for a paid order.
 * Credits the seller's pendingBalance, creates wallet mutation,
 * creates commission transaction, and creates notifications.
 *
 * This shared function is used by:
 * - /api/wallet/debit (MartUp Pay)
 * - /api/wallet/debit-batch (batch payment)
 * - /api/payment/notification (Midtrans webhook)
 *
 * MUST be called inside a db.$transaction() — uses the tx (transaction client).
 */
export async function processSellerPayout(params: {
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
  sellerId: string
  sellerUserId: string
  storeName: string
  orderId: string
  orderNumber: string
  subtotal: number
  commissionRate: number
  buyerName: string
  totalAmount: number
  buyerId: string
}): Promise<{ sellerEarnings: number; commissionAmount: number }> {
  const {
    tx,
    sellerId,
    sellerUserId,
    storeName,
    orderId,
    orderNumber,
    subtotal,
    commissionRate,
    buyerName,
    totalAmount,
    buyerId,
  } = params

  const commissionAmount = Math.round(subtotal * commissionRate)
  const sellerEarnings = subtotal - commissionAmount

  // Find or create seller wallet (unified — one wallet per user)
  let sellerWallet = await tx.wallet.findUnique({
    where: { userId: sellerUserId },
  })

  if (!sellerWallet) {
    sellerWallet = await tx.wallet.create({
      data: {
        userId: sellerUserId,
        balance: 0,
        holdBalance: 0,
        pendingBalance: 0,
      },
    })
  }

  // Credit seller's pending balance
  const updatedSellerWallet = await tx.wallet.update({
    where: { id: sellerWallet.id },
    data: { pendingBalance: { increment: sellerEarnings } },
  })

  // Create seller wallet mutation (credit)
  await tx.walletMutation.create({
    data: {
      walletId: sellerWallet.id,
      type: 'credit',
      amount: sellerEarnings,
      balance: Number(updatedSellerWallet.balance),
      description: `Pendapatan dari pesanan ${orderNumber} - ${storeName}`,
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

  // Create notification for buyer
  await tx.notification.create({
    data: {
      userId: buyerId,
      title: 'Pembayaran Berhasil',
      content: `Pembayaran untuk pesanan ${orderNumber} sebesar Rp ${totalAmount.toLocaleString('id-ID')} telah berhasil.`,
      type: 'order',
      refType: 'order',
      refId: orderId,
    },
  })

  // Create notification for seller
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

  return { sellerEarnings, commissionAmount }
}
