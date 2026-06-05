import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

import { logger } from '@/lib/logger'

/** Timing-safe string comparison to prevent timing attacks */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}
// ==================== Midtrans Configuration ====================

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ''

// ==================== POST /api/payment/notification ====================
// Midtrans webhook callback — called by Midtrans servers when payment status changes.
// NO standard auth required (Midtrans calls this from their servers).
// MUST verify the notification signature before processing.
// IDEMPOTENCY: Checks order/deposit's current status to prevent duplicate processing.
// Handles both ORDER payments (orderNumber) and DEPOSIT payments (DEPOSIT-{id}).

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      transaction_time,
      transaction_status,
      transaction_id,
      status_message,
      status_code,
      signature_key,
      payment_type,
      order_id,
      merchant_id,
      gross_amount,
      fraud_status,
      currency,
    } = body

    // Step 1: Verify the notification signature to ensure it's from Midtrans
    // Signature = SHA512(order_id + status_code + gross_amount + SERVER_KEY)
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`)
      .digest('hex')

    if (!signature_key || !expectedSignature || !safeCompare(signature_key, expectedSignature)) {
      logger.error({ orderId: order_id }, 'Midtrans notification signature mismatch')
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 403 }
      )
    }

    // Step 2: Route based on order_id prefix
    // DEPOSIT-{id} → deposit payment processing
    // Otherwise → order payment processing (existing logic)
    const isDeposit = order_id.startsWith('DEPOSIT-')

    if (isDeposit) {
      return handleDepositNotification({
        order_id,
        transaction_status,
        transaction_id,
        status_code,
        payment_type,
        gross_amount,
        fraud_status,
        transaction_time,
      })
    }

    // ==================== ORDER PAYMENT PROCESSING ====================

    // Find the order by orderNumber
    const order = await db.order.findUnique({
      where: { orderNumber: order_id },
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
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!order) {
      logger.error({ err: order_id }, 'Midtrans notification: Order not found for orderNumber')
      // Return 200 so Midtrans doesn't retry indefinitely
      return NextResponse.json({ success: false, error: 'Order not found' })
    }

    // SEC-15: Verify the gross_amount matches the order's totalAmount to prevent amount manipulation
    // SECURITY: Use string comparison to avoid floating-point precision loss with Number()
    if (String(gross_amount) !== String(order.totalAmount)) {
      logger.error({
        orderId: order.id,
        orderNumber: order.orderNumber,
        expectedAmount: String(order.totalAmount),
        receivedAmount: String(gross_amount),
      }, 'Midtrans notification: gross_amount does not match order totalAmount')
      return NextResponse.json(
        { success: false, error: 'Amount mismatch' },
        { status: 400 }
      )
    }

    // IDEMPOTENCY CHECK: If the order is already in the target state, skip processing
    if (transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept')) {
      if (order.paymentStatus === 'paid') {
        logger.info({
          orderId: order.id,
          orderNumber: order.orderNumber,
          currentPaymentStatus: order.paymentStatus,
        }, 'Midtrans notification: Order already paid, skipping duplicate processing:')
        return NextResponse.json({ success: true, message: 'Notification already processed' })
      }
    }

    if (transaction_status === 'cancel' || transaction_status === 'expire' || transaction_status === 'deny') {
      if (order.paymentStatus === 'cancelled' || order.paymentStatus === 'expired' || order.paymentStatus === 'denied') {
        logger.info({
          orderId: order.id,
          orderNumber: order.orderNumber,
          currentPaymentStatus: order.paymentStatus,
        }, 'Midtrans notification: Order already in terminal state, skipping:')
        return NextResponse.json({ success: true, message: 'Notification already processed' })
      }
    }

    // Step 3: Determine the new order and payment status based on transaction_status
    let newOrderStatus: string | null = null
    let newPaymentStatus: string | null = null
    let paidAt: Date | null = null
    let cancelledAt: Date | null = null
    let cancelReason: string | null = null
    let paymentReference: string | null = null

    switch (transaction_status) {
      case 'capture':
        if (fraud_status === 'accept') {
          newOrderStatus = 'paid'
          newPaymentStatus = 'paid'
          paidAt = new Date()
        } else if (fraud_status === 'challenge') {
          newPaymentStatus = 'challenged'
        } else {
          newOrderStatus = 'cancelled'
          newPaymentStatus = 'denied'
          cancelledAt = new Date()
          cancelReason = 'Payment denied by fraud detection'
        }
        break

      case 'settlement':
        newOrderStatus = 'paid'
        newPaymentStatus = 'paid'
        paidAt = new Date()
        break

      case 'pending':
        newPaymentStatus = 'pending'
        // Save payment reference from notification (VA numbers, payment codes, etc.)
        if (body.va_numbers || body.permata_va_number || body.payment_code || body.bill_key || body.biller_code) {
          const ref: Record<string, unknown> = {}
          if (body.va_numbers && Array.isArray(body.va_numbers)) {
            ref.va_numbers = body.va_numbers
            ref.va_number = body.va_numbers[0]?.va_number
            ref.bank = body.va_numbers[0]?.bank
          }
          if (body.permata_va_number) {
            ref.permata_va_number = body.permata_va_number
            if (!ref.va_number) {
              ref.va_number = body.permata_va_number
              ref.bank = 'permata'
            }
          }
          if (body.payment_code) ref.payment_code = body.payment_code
          if (body.bill_key) ref.bill_key = body.bill_key
          if (body.biller_code) ref.biller_code = body.biller_code
          if (payment_type) ref.payment_type = payment_type
          // Only update paymentReference if we have useful data
          if (ref.va_number || ref.payment_code || ref.bill_key) {
            paymentReference = JSON.stringify(ref)
          }
        }
        break

      case 'deny':
        newOrderStatus = 'cancelled'
        newPaymentStatus = 'denied'
        cancelledAt = new Date()
        cancelReason = 'Payment denied by provider'
        break

      case 'cancel':
        newOrderStatus = 'cancelled'
        newPaymentStatus = 'cancelled'
        cancelledAt = new Date()
        cancelReason = 'Payment cancelled'
        break

      case 'expire':
        newOrderStatus = 'cancelled'
        newPaymentStatus = 'expired'
        cancelledAt = new Date()
        cancelReason = 'Payment expired'
        break

      case 'refund':
        newOrderStatus = 'refunded'
        newPaymentStatus = 'refunded'
        break

      case 'partial_refund':
        newPaymentStatus = 'partial_refund'
        break

      default:
        logger.warn({ transaction_status }, 'Midtrans notification: Unhandled transaction_status')
        return NextResponse.json({ success: true, message: 'Notification received but status not handled' })
    }

    // Step 4: Process the status change in a database transaction
    await db.$transaction(async (tx) => {
      const orderUpdateData: Record<string, unknown> = {}
      if (newOrderStatus) orderUpdateData.status = newOrderStatus
      if (newPaymentStatus) orderUpdateData.paymentStatus = newPaymentStatus
      if (paidAt) orderUpdateData.paidAt = paidAt
      if (cancelledAt) orderUpdateData.cancelledAt = cancelledAt
      if (cancelReason) orderUpdateData.cancelReason = cancelReason
      if (payment_type) orderUpdateData.paymentMethod = payment_type
      if (paymentReference) orderUpdateData.paymentReference = paymentReference

      await tx.order.update({
        where: { id: order.id },
        data: orderUpdateData,
      })

      // Update the Transaction record status
      const transactionRecord = await tx.transaction.findFirst({
        where: {
          type: 'payment',
          refId: order.orderNumber,
        },
      })

      if (transactionRecord) {
        const txStatusMap: Record<string, string> = {
          paid: 'success',
          pending: 'pending',
          challenged: 'pending',
          denied: 'failed',
          cancelled: 'failed',
          expired: 'failed',
          refunded: 'refunded',
          partial_refund: 'partial_refund',
        }
        await tx.transaction.update({
          where: { id: transactionRecord.id },
          data: {
            status: txStatusMap[newPaymentStatus || ''] || 'pending',
            method: payment_type || transactionRecord.method,
          },
        })
      }

      // Step 5: On successful payment, process seller payout
      if (newPaymentStatus === 'paid' && (transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept'))) {
        const existingMutation = await tx.walletMutation.findFirst({
          where: {
            refType: 'order',
            refId: order.id,
            type: 'credit',
            description: { contains: order.orderNumber },
          },
        })

        if (existingMutation) {
          logger.info({ orderNumber: order.orderNumber }, 'Midtrans notification: Seller payout already processed for order')
          return
        }

        const subtotal = Number(order.subtotal)
        const commissionRate = Number(order.seller.commissionRate)
        const commissionAmount = Math.round(subtotal * commissionRate)
        const sellerEarnings = subtotal - commissionAmount

        // Find or create seller wallet (unified — one wallet per user)
        let sellerWallet = await tx.wallet.findUnique({
          where: { userId: order.seller.userId },
        })

        if (!sellerWallet) {
          sellerWallet = await tx.wallet.create({
            data: {
              userId: order.seller.userId,
              balance: 0,
              holdBalance: 0,
              pendingBalance: 0,
            },
          })
        }

        const updatedWallet = await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: {
            pendingBalance: { increment: sellerEarnings },
          },
        })

        const newBalance = Number(updatedWallet.balance)

        await tx.walletMutation.create({
          data: {
            walletId: sellerWallet.id,
            type: 'credit',
            amount: sellerEarnings,
            balance: newBalance,
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
      }

      // Step 6: On cancellation/expiry, create notification
      if (newOrderStatus === 'cancelled') {
        await tx.notification.create({
          data: {
            userId: order.userId,
            title: 'Pesanan Dibatalkan',
            content: `Pesanan ${order.orderNumber} telah dibatalkan. Alasan: ${cancelReason || 'Pembayaran gagal'}.`,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })
      }

      // Step 7: On refund, create notification
      if (newPaymentStatus === 'refunded') {
        await tx.notification.create({
          data: {
            userId: order.userId,
            title: 'Pengembalian Dana',
            content: `Pengembalian dana untuk pesanan ${order.orderNumber} sebesar Rp ${Number(order.totalAmount).toLocaleString('id-ID')} sedang diproses.`,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })
      }
    })

    logger.info({
      orderId: order.id,
      orderNumber: order.orderNumber,
      transactionStatus: transaction_status,
      paymentType: payment_type,
      newOrderStatus,
      newPaymentStatus,
      transactionId: transaction_id,
      transactionTime: transaction_time,
    }, 'Midtrans notification processed:')

    return NextResponse.json({ success: true, message: 'Notification processed' })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Payment Notification POST error')
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' })
  }
}

// ==================== DEPOSIT NOTIFICATION HANDLER ====================

async function handleDepositNotification({
  order_id,
  transaction_status,
  transaction_id,
  status_code,
  payment_type,
  gross_amount,
  fraud_status,
  transaction_time,
}: {
  order_id: string
  transaction_status: string
  transaction_id: string
  status_code: string
  payment_type: string
  gross_amount: string
  fraud_status?: string
  transaction_time: string
}): Promise<NextResponse> {
  // Extract deposit ID from order_id (format: DEPOSIT-{cuid})
  const depositId = order_id.replace('DEPOSIT-', '')

  // Find the deposit
  const deposit = await db.deposit.findUnique({
    where: { id: depositId },
    include: {
      user: {
        select: { id: true, name: true, email: true, wallet: true },
      },
    },
  })

  if (!deposit) {
    logger.error({ depositId, order_id }, 'Midtrans deposit notification: Deposit not found')
    // Return 200 so Midtrans doesn't retry indefinitely
    return NextResponse.json({ success: false, error: 'Deposit not found' })
  }

  // SECURITY: Verify gross_amount matches deposit amount
  // Use string comparison to avoid floating-point precision loss with Number()
  if (String(gross_amount) !== String(deposit.amount)) {
    logger.error({
      depositId: deposit.id,
      midtransOrderId: order_id,
      expectedAmount: String(deposit.amount),
      receivedAmount: String(gross_amount),
    }, 'Midtrans deposit notification: gross_amount does not match deposit amount')
    return NextResponse.json(
      { success: false, error: 'Amount mismatch' },
      { status: 400 }
    )
  }

  // IDEMPOTENCY CHECK: Skip if already in terminal state
  if (deposit.status === 'success') {
    logger.info({ depositId: deposit.id }, 'Midtrans deposit notification: Deposit already processed as success')
    return NextResponse.json({ success: true, message: 'Deposit already processed' })
  }

  if (deposit.status === 'failed' || deposit.status === 'expired') {
    if (transaction_status === 'cancel' || transaction_status === 'expire' || transaction_status === 'deny') {
      logger.info({ depositId: deposit.id }, 'Midtrans deposit notification: Deposit already in terminal state')
      return NextResponse.json({ success: true, message: 'Deposit already in terminal state' })
    }
  }

  // Determine deposit status based on transaction_status
  let newDepositStatus: string | null = null
  let isPaymentSuccess = false

  switch (transaction_status) {
    case 'capture':
      if (fraud_status === 'accept') {
        newDepositStatus = 'success'
        isPaymentSuccess = true
      } else if (fraud_status === 'challenge') {
        newDepositStatus = 'pending' // Keep pending for challenged payments
      } else {
        newDepositStatus = 'failed'
      }
      break

    case 'settlement':
      newDepositStatus = 'success'
      isPaymentSuccess = true
      break

    case 'pending':
      // Still pending — user hasn't completed payment yet
      newDepositStatus = 'pending'
      break

    case 'deny':
      newDepositStatus = 'failed'
      break

    case 'cancel':
      newDepositStatus = 'failed'
      break

    case 'expire':
      newDepositStatus = 'expired'
      break

    case 'refund':
    case 'partial_refund':
      // Refunds on deposits — keep as failed (shouldn't normally happen for deposits)
      newDepositStatus = 'failed'
      break

    default:
      logger.warn({ transaction_status }, 'Midtrans deposit notification: Unhandled transaction_status')
      return NextResponse.json({ success: true, message: 'Notification received but status not handled' })
  }

  // Process the deposit status change in a database transaction
  await db.$transaction(async (tx) => {
    // Update deposit record
    const depositUpdateData: Record<string, unknown> = {}
    if (newDepositStatus) depositUpdateData.status = newDepositStatus
    if (payment_type) depositUpdateData.paymentType = payment_type
    if (transaction_id) depositUpdateData.midtransTransactionId = transaction_id
    if (isPaymentSuccess) {
      depositUpdateData.verifiedAt = new Date()
    }

    await tx.deposit.update({
      where: { id: deposit.id },
      data: depositUpdateData,
    })

    // Update the Transaction record status
    const transactionRecord = await tx.transaction.findFirst({
      where: {
        type: 'deposit',
        refId: deposit.id,
      },
    })

    if (transactionRecord) {
      const txStatusMap: Record<string, string> = {
        success: 'success',
        pending: 'pending',
        failed: 'failed',
        expired: 'failed',
      }
      await tx.transaction.update({
        where: { id: transactionRecord.id },
        data: {
          status: txStatusMap[newDepositStatus || ''] || 'pending',
          method: payment_type || transactionRecord.method,
          description: isPaymentSuccess
            ? `Top Up via Midtrans (${payment_type}) — berhasil`
            : transaction_status === 'pending'
              ? `Top Up via Midtrans (${payment_type}) — menunggu pembayaran`
              : `Top Up via Midtrans (${payment_type}) — ${transaction_status}`,
        },
      })
    }

    // On successful payment: credit user wallet atomically
    if (isPaymentSuccess) {
      // IDEMPOTENCY: Check if wallet already credited for this deposit
      const existingMutation = await tx.walletMutation.findFirst({
        where: {
          refType: 'deposit',
          refId: deposit.id,
          type: 'credit',
        },
      })

      if (existingMutation) {
        logger.info({ depositId: deposit.id }, 'Midtrans deposit notification: Wallet already credited for deposit')
        return // Skip, already processed
      }

      // Find or create user wallet
      let wallet = deposit.user.wallet
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: deposit.user.id,
            balance: 0,
            holdBalance: 0,
            pendingBalance: 0,
          },
        })
      }

      // Credit the wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: Number(deposit.amount) },
        },
      })

      const newBalance = Number(updatedWallet.balance)

      // Create wallet mutation record
      await tx.walletMutation.create({
        data: {
          walletId: wallet.id,
          type: 'credit',
          amount: Number(deposit.amount),
          balance: newBalance,
          description: `Top Up saldo via Midtrans (${payment_type}) — Rp ${Number(deposit.amount).toLocaleString('id-ID')}`,
          refType: 'deposit',
          refId: deposit.id,
        },
      })

      // Create notification for user
      await tx.notification.create({
        data: {
          userId: deposit.user.id,
          title: 'Top Up Berhasil!',
          content: `Top up sebesar Rp ${Number(deposit.amount).toLocaleString('id-ID')} via Midtrans (${payment_type}) berhasil. Saldo Anda telah ditambahkan.`,
          type: 'system',
          refType: 'deposit',
          refId: deposit.id,
        },
      })

      logger.info({
        depositId: deposit.id,
        userId: deposit.user.id,
        amount: Number(deposit.amount),
        paymentType: payment_type,
        newBalance,
      }, 'Midtrans deposit: Wallet credited successfully')
    }

    // On failure/expiry: create notification
    if (newDepositStatus === 'failed' || newDepositStatus === 'expired') {
      await tx.notification.create({
        data: {
          userId: deposit.user.id,
          title: newDepositStatus === 'expired' ? 'Top Up Kadaluarsa' : 'Top Up Gagal',
          content: newDepositStatus === 'expired'
            ? `Top up sebesar Rp ${Number(deposit.amount).toLocaleString('id-ID')} telah kadaluarsa. Silakan buat top up baru.`
            : `Top up sebesar Rp ${Number(deposit.amount).toLocaleString('id-ID')} gagal diproses. Silakan coba lagi.`,
          type: 'system',
          refType: 'deposit',
          refId: deposit.id,
        },
      })
    }
  })

  logger.info({
    depositId: deposit.id,
    midtransOrderId: order_id,
    transactionStatus: transaction_status,
    paymentType: payment_type,
    newDepositStatus,
    transactionId: transaction_id,
    transactionTime: transaction_time,
  }, 'Midtrans deposit notification processed:')

  return NextResponse.json({ success: true, message: 'Deposit notification processed' })
}
