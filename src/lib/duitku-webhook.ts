// ==================== DUITKU WEBHOOK PROCESSING ====================
// Shared server-side handlers for Duitku payment callbacks.
// Used by: /api/payment/callback (webhook) and /api/payment/status (sync on demand)
//
// Ports the proven logic from the old Midtrans notification route:
//   - ORDER payments: mark paid → seller escrow payout (pendingBalance) + commission + notifications
//   - DEPOSIT payments (DEPOSIT-{id}): credit buyer wallet + notifications
//   - Idempotency checks so duplicate callbacks never double-credit

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export interface DuitkuPaymentMeta {
  resultCode: string // '00' success, '01' pending, '02' failed
  paymentCode?: string // Duitku method code (BC, OV, DA, IR, ...)
  reference?: string // Duitku reference number
  settlementDate?: string
  merchantOrderId?: string
}

// ==================== ORDER PAYMENT ====================

/**
 * Process an ORDER payment result from Duitku.
 * Returns: { handled, outcome, message }
 */
export async function processOrderPaymentResult(
  orderNumber: string,
  meta: DuitkuPaymentMeta
): Promise<{ handled: boolean; outcome: 'paid' | 'pending' | 'failed' | 'not_found' | 'ignored'; message?: string }> {
  // Find the order by orderNumber (merchantOrderId === order.orderNumber)
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      seller: {
        select: {
          id: true,
          userId: true,
          storeName: true,
          commissionRate: true,
        },
      },
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  if (!order) {
    logger.error({ orderNumber }, 'Duitku callback: Order not found for orderNumber')
    return { handled: false, outcome: 'not_found', message: 'Order not found' }
  }

  const isPaid = meta.resultCode === '00'
  const isPending = meta.resultCode === '01'
  const isFailed = meta.resultCode === '02'

  // SECURITY: amount check happens in the caller (callback route) — it has the raw amount

  // ==================== IDEMPOTENCY CHECKS ====================
  if (isPaid && order.paymentStatus === 'paid') {
    logger.info({ orderNumber }, 'Duitku callback: Order already paid, skipping duplicate')
    return { handled: true, outcome: 'paid', message: 'Already processed' }
  }
  if (isFailed && ['cancelled', 'expired', 'denied'].includes(order.paymentStatus)) {
    logger.info({ orderNumber }, 'Duitku callback: Order already in terminal state')
    return { handled: true, outcome: 'failed', message: 'Already processed' }
  }
  if (isPending && order.paymentStatus === 'paid') {
    // A late "pending" callback for an already-paid order — ignore
    return { handled: true, outcome: 'paid', message: 'Already paid' }
  }

  // Save payment reference for display (VA number etc. come via paymentCode)
  const paymentReference = JSON.stringify({
    provider: 'duitku',
    reference: meta.reference || null,
    paymentCode: meta.paymentCode || null,
    settlementDate: meta.settlementDate || null,
  })

  const methodLabel = meta.paymentCode || 'duitku'

  if (isPending) {
    await db.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'pending',
        paymentMethod: methodLabel,
        paymentReference,
      },
    })
    return { handled: true, outcome: 'pending' }
  }

  if (isFailed) {
    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'cancelled',
          paymentStatus: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: 'Pembayaran gagal atau dibatalkan (Duitku)',
          paymentMethod: methodLabel,
          paymentReference,
        },
      })

      // Mark transaction failed
      const transactionRecord = await tx.transaction.findFirst({
        where: { type: 'payment', refId: order.orderNumber, status: 'pending' },
      })
      if (transactionRecord) {
        await tx.transaction.update({
          where: { id: transactionRecord.id },
          data: { status: 'failed', method: methodLabel },
        })
      }

      // Restore product stock
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
          title: 'Pembayaran Gagal',
          content: `Pembayaran untuk pesanan ${order.orderNumber} gagal atau dibatalkan. Pesanan telah dibatalkan dan stok dikembalikan.`,
          type: 'order',
          refType: 'order',
          refId: order.id,
        },
      })
    })
    return { handled: true, outcome: 'failed' }
  }

  // ==================== PAID ====================
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paymentStatus: 'paid',
        paidAt: new Date(),
        paymentMethod: methodLabel,
        paymentReference,
      },
    })

    // Update Transaction record
    const transactionRecord = await tx.transaction.findFirst({
      where: { type: 'payment', refId: order.orderNumber },
      orderBy: { createdAt: 'desc' },
    })
    if (transactionRecord) {
      await tx.transaction.update({
        where: { id: transactionRecord.id },
        data: {
          status: 'success',
          method: methodLabel,
          description: `Payment for order ${order.orderNumber} via Duitku (${methodLabel})`,
        },
      })
    }

    // ==================== SELLER PAYOUT (escrow) ====================
    // Idempotency: skip if a credit mutation already exists for this order
    const existingMutation = await tx.walletMutation.findFirst({
      where: {
        refType: 'order',
        refId: order.id,
        type: 'credit',
        description: { contains: order.orderNumber },
      },
    })

    if (!existingMutation) {
      const subtotal = Number(order.subtotal)
      const commissionRate = Number(order.seller.commissionRate)
      const commissionAmount = Math.round(subtotal * commissionRate)
      const sellerEarnings = subtotal - commissionAmount

      let sellerWallet = await tx.wallet.findUnique({
        where: { userId: order.seller.userId },
      })
      if (!sellerWallet) {
        sellerWallet = await tx.wallet.create({
          data: { userId: order.seller.userId, balance: 0, holdBalance: 0, pendingBalance: 0 },
        })
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: sellerWallet.id },
        data: { pendingBalance: { increment: sellerEarnings } },
      })

      await tx.walletMutation.create({
        data: {
          walletId: sellerWallet.id,
          type: 'credit',
          amount: sellerEarnings,
          balance: Number(updatedWallet.balance),
          description: `Pendapatan dari pesanan ${order.orderNumber} - ${order.seller.storeName}`,
          refType: 'order',
          refId: order.id,
        },
      })

      if (commissionAmount > 0) {
        await tx.transaction.create({
          data: {
            userId: order.seller.userId,
            type: 'cashback',
            amount: commissionAmount,
            fee: 0,
            netAmount: commissionAmount,
            method: 'commission',
            status: 'success',
            description: `Platform commission (${(commissionRate * 100).toFixed(1)}%) from order ${order.orderNumber}`,
            refId: order.orderNumber,
          },
        })
      }
    }

    // Notifications
    await tx.notification.create({
      data: {
        userId: order.userId,
        title: 'Pembayaran Berhasil',
        content: `Pembayaran untuk pesanan ${order.orderNumber} sebesar Rp ${Number(order.totalAmount).toLocaleString('id-ID')} telah berhasil diproses.`,
        type: 'order',
        refType: 'order',
        refId: order.id,
      },
    })
    await tx.notification.create({
      data: {
        userId: order.seller.userId,
        title: 'Pesanan Baru Dibayar',
        content: `Pesanan ${order.orderNumber} dari ${order.user.name} telah dibayar sebesar Rp ${Number(order.totalAmount).toLocaleString('id-ID')}. Segera proses pesanan!`,
        type: 'order',
        refType: 'order',
        refId: order.id,
      },
    })
  })

  logger.info({ orderNumber, paymentCode: meta.paymentCode, reference: meta.reference }, 'Duitku order payment processed as PAID')
  return { handled: true, outcome: 'paid' }
}

// ==================== DEPOSIT PAYMENT ====================

/**
 * Process a DEPOSIT payment result from Duitku (merchantOrderId = DEPOSIT-{id}).
 * Returns: { handled, outcome, message }
 */
export async function processDepositPaymentResult(
  depositId: string,
  meta: DuitkuPaymentMeta
): Promise<{ handled: boolean; outcome: 'paid' | 'pending' | 'failed' | 'not_found' | 'ignored'; message?: string }> {
  const deposit = await db.deposit.findUnique({
    where: { id: depositId },
    include: {
      user: {
        select: { id: true, name: true, email: true, wallet: true },
      },
    },
  })

  if (!deposit) {
    logger.error({ depositId }, 'Duitku callback: Deposit not found')
    return { handled: false, outcome: 'not_found', message: 'Deposit not found' }
  }

  const isPaid = meta.resultCode === '00'
  const isPending = meta.resultCode === '01'
  const isFailed = meta.resultCode === '02'

  // Idempotency
  if (isPaid && deposit.status === 'success') {
    logger.info({ depositId }, 'Duitku callback: Deposit already processed as success')
    return { handled: true, outcome: 'paid', message: 'Already processed' }
  }
  if (isFailed && (deposit.status === 'failed' || deposit.status === 'expired')) {
    return { handled: true, outcome: 'failed', message: 'Already in terminal state' }
  }

  const methodLabel = meta.paymentCode || 'duitku'

  if (isPending) {
    await db.deposit.update({
      where: { id: deposit.id },
      data: { status: 'pending', paymentType: methodLabel },
    })
    return { handled: true, outcome: 'pending' }
  }

  if (isFailed) {
    await db.$transaction(async (tx) => {
      await tx.deposit.update({
        where: { id: deposit.id },
        data: { status: 'failed', paymentType: methodLabel },
      })

      const transactionRecord = await tx.transaction.findFirst({
        where: { type: 'deposit', refId: deposit.id },
        orderBy: { createdAt: 'desc' },
      })
      if (transactionRecord) {
        await tx.transaction.update({
          where: { id: transactionRecord.id },
          data: { status: 'failed', method: methodLabel },
        })
      }

      await tx.notification.create({
        data: {
          userId: deposit.user.id,
          title: 'Top Up Gagal',
          content: `Top up sebesar Rp ${Number(deposit.amount).toLocaleString('id-ID')} gagal diproses. Silakan coba lagi.`,
          type: 'system',
          refType: 'deposit',
          refId: deposit.id,
        },
      })
    })
    return { handled: true, outcome: 'failed' }
  }

  // ==================== PAID — credit wallet ====================
  await db.$transaction(async (tx) => {
    await tx.deposit.update({
      where: { id: deposit.id },
      data: {
        status: 'success',
        paymentType: methodLabel,
        midtransTransactionId: meta.reference || undefined, // keep column for provider reference
        verifiedAt: new Date(),
      },
    })

    const transactionRecord = await tx.transaction.findFirst({
      where: { type: 'deposit', refId: deposit.id },
      orderBy: { createdAt: 'desc' },
    })
    if (transactionRecord) {
      await tx.transaction.update({
        where: { id: transactionRecord.id },
        data: {
          status: 'success',
          method: methodLabel,
          description: `Top Up via Duitku (${methodLabel}) — berhasil`,
        },
      })
    }

    // Idempotency: wallet already credited?
    const existingMutation = await tx.walletMutation.findFirst({
      where: { refType: 'deposit', refId: deposit.id, type: 'credit' },
    })
    if (existingMutation) {
      logger.info({ depositId: deposit.id }, 'Duitku deposit: Wallet already credited')
      return
    }

    let wallet = deposit.user.wallet
    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { userId: deposit.user.id, balance: 0, holdBalance: 0, pendingBalance: 0 },
      })
    }

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: Number(deposit.amount) } },
    })

    await tx.walletMutation.create({
      data: {
        walletId: wallet.id,
        type: 'credit',
        amount: Number(deposit.amount),
        balance: Number(updatedWallet.balance),
        description: `Top Up saldo via Duitku (${methodLabel}) — Rp ${Number(deposit.amount).toLocaleString('id-ID')}`,
        refType: 'deposit',
        refId: deposit.id,
      },
    })

    await tx.notification.create({
      data: {
        userId: deposit.user.id,
        title: 'Top Up Berhasil!',
        content: `Top up sebesar Rp ${Number(deposit.amount).toLocaleString('id-ID')} via Duitku berhasil. Saldo Anda telah ditambahkan.`,
        type: 'system',
        refType: 'deposit',
        refId: deposit.id,
      },
    })
  })

  logger.info({ depositId: deposit.id, reference: meta.reference }, 'Duitku deposit payment processed as PAID')
  return { handled: true, outcome: 'paid' }
}
