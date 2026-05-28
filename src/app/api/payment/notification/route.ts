import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

import { logger } from '@/lib/logger'
// ==================== Midtrans Configuration ====================

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ''

// ==================== POST /api/payment/notification ====================
// Midtrans webhook callback — called by Midtrans servers when payment status changes.
// NO standard auth required (Midtrans calls this from their servers).
// MUST verify the notification signature before processing.
// IDEMPOTENCY: Checks order's current status to prevent duplicate processing.

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

    if (signature_key !== expectedSignature) {
      logger.error({ orderId: order_id, receivedSignature: signature_key }, 'Midtrans notification signature mismatch')
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 403 }
      )
    }

    // Step 2: Find the order by orderNumber
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
            wallet: true,
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

    // IDEMPOTENCY CHECK: If the order is already in the target state, skip processing
    // This prevents duplicate wallet mutations from Midtrans retrying notifications
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

    switch (transaction_status) {
      case 'capture':
        // Credit card capture — check fraud status
        if (fraud_status === 'accept') {
          newOrderStatus = 'paid'
          newPaymentStatus = 'paid'
          paidAt = new Date()
        } else if (fraud_status === 'challenge') {
          // Payment is challenged — keep pending
          newPaymentStatus = 'challenged'
        } else {
          // Fraud denied
          newOrderStatus = 'cancelled'
          newPaymentStatus = 'denied'
          cancelledAt = new Date()
          cancelReason = 'Payment denied by fraud detection'
        }
        break

      case 'settlement':
        // Payment completed successfully
        newOrderStatus = 'paid'
        newPaymentStatus = 'paid'
        paidAt = new Date()
        break

      case 'pending':
        // Payment pending — user hasn't completed payment yet
        newPaymentStatus = 'pending'
        break

      case 'deny':
        // Payment denied by the payment provider
        newOrderStatus = 'cancelled'
        newPaymentStatus = 'denied'
        cancelledAt = new Date()
        cancelReason = 'Payment denied by provider'
        break

      case 'cancel':
        // Payment cancelled
        newOrderStatus = 'cancelled'
        newPaymentStatus = 'cancelled'
        cancelledAt = new Date()
        cancelReason = 'Payment cancelled'
        break

      case 'expire':
        // Payment expired (not paid within the time limit)
        newOrderStatus = 'cancelled'
        newPaymentStatus = 'expired'
        cancelledAt = new Date()
        cancelReason = 'Payment expired'
        break

      case 'refund':
        // Payment refunded
        newOrderStatus = 'refunded'
        newPaymentStatus = 'refunded'
        break

      case 'partial_refund':
        // Partial refund — keep order as is, note the partial refund
        newPaymentStatus = 'partial_refund'
        break

      default:
        logger.warn({ transaction_status }, 'Midtrans notification: Unhandled transaction_status')
        // Acknowledge receipt but don't process unknown statuses
        return NextResponse.json({ success: true, message: 'Notification received but status not handled' })
    }

    // Step 4: Process the status change in a database transaction
    await db.$transaction(async (tx) => {
      // Build update data for the order
      const orderUpdateData: Record<string, unknown> = {}
      if (newOrderStatus) orderUpdateData.status = newOrderStatus
      if (newPaymentStatus) orderUpdateData.paymentStatus = newPaymentStatus
      if (paidAt) orderUpdateData.paidAt = paidAt
      if (cancelledAt) orderUpdateData.cancelledAt = cancelledAt
      if (cancelReason) orderUpdateData.cancelReason = cancelReason
      if (payment_type) orderUpdateData.paymentMethod = payment_type

      // Update the order
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

      // Step 5: On successful payment (settlement or capture+accept), process seller payout
      if (newPaymentStatus === 'paid' && (transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept'))) {
        // IDEMPOTENCY: Double-check no wallet mutation already exists for this order
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
          return // Skip payout, already processed
        }

        // Calculate seller earnings: subtotal - platform fee (commission)
        const subtotal = Number(order.subtotal)
        const commissionRate = Number(order.seller.commissionRate)
        const commissionAmount = Math.round(subtotal * commissionRate)
        const sellerEarnings = subtotal - commissionAmount

        // Credit the seller's wallet
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

        // Add earnings to seller's pendingBalance (funds become available after delivery/confirmation)
        const updatedWallet = await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: {
            pendingBalance: { increment: sellerEarnings },
          },
        })

        const newBalance = Number(updatedWallet.balance)

        // Create wallet mutation record for seller (credit)
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

        // Create platform fee transaction (commission)
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

        // Create notification for buyer
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

        // Create notification for seller
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

    // Log the notification for audit purposes
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

    // Always return 200 to acknowledge receipt to Midtrans
    return NextResponse.json({ success: true, message: 'Notification processed' })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Payment Notification POST error')
    // Still return 200 so Midtrans doesn't keep retrying
    // But log the error for investigation
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server' })
  }
}
