// ==================== ORDER STATUS UPDATE UTILITY ====================
// Shared business logic for updating order status.
// Used by both /api/orders/[id]/status and /api/admin/orders routes
// to avoid internal HTTP fetch calls.

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import { sendOrderNotification, type OrderNotificationType } from '@/lib/order-notifications'
import type { OrderEmailData } from '@/lib/email-templates'
import { logStockChangeInTx } from '@/lib/stock-utils'
import { getEffectiveCommissionRate } from '@/lib/commission'

// ==================== Valid Status Transitions ====================
export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'shipped', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['cancelled', 'refunded'], // cancelled for complaint, refunded for refund within window
  cancelled: [], // terminal state
  refunded: [], // terminal state
}

export const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']

// NOTE: getCommissionRate() has been moved to @/lib/commission as getEffectiveCommissionRate()
// to share the logic between this module and wallet/debit/route.ts

export interface UpdateOrderStatusParams {
  orderId: string
  newStatus: string
  trackingNumber?: string
  cancelReason?: string
  updatedBy: string // userId of the person making the change
  paymentStatusOverride?: string // optional override for paymentStatus (e.g. 'expired' for cancelled unpaid orders)
}

export interface UpdateOrderStatusResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  status?: number
}

/**
 * Core business logic for updating an order's status.
 * Handles:
 * 1. Validate status transition
 * 2. Update order in transaction
 * 3. Update shipping if shipped/delivered
 * 4. Release escrow if delivered
 * 5. Restore stock + refund if cancelled
 * 6. Create notifications for buyer and seller
 * 7. Send email notification (if user has emailNotif enabled)
 * 8. Send push notification (if FCM token exists)
 */
export async function updateOrderStatus(params: UpdateOrderStatusParams): Promise<UpdateOrderStatusResult> {
  const { orderId, newStatus, trackingNumber, cancelReason, updatedBy, paymentStatusOverride } = params
  const startTime = Date.now()

  try {
    // Validate status value
    if (!VALID_STATUSES.includes(newStatus)) {
      return {
        success: false,
        error: `Status tidak valid. Pilihan: ${VALID_STATUSES.join(', ')}`,
        status: 400,
      }
    }

    // Validate cancel reason when status is 'cancelled'
    // For 'refunded', a reason is optional (defaults to 'Refunded')
    if (newStatus === 'cancelled') {
      if (!cancelReason || typeof cancelReason !== 'string' || cancelReason.trim().length === 0) {
        return {
          success: false,
          error: 'Alasan pembatalan wajib diisi saat membatalkan pesanan',
          status: 400,
        }
      }
      if (cancelReason.length > 500) {
        return {
          success: false,
          error: 'Alasan pembatalan maksimal 500 karakter',
          status: 400,
        }
      }
    }
    if (newStatus === 'refunded' && cancelReason && cancelReason.length > 500) {
      return {
        success: false,
        error: 'Alasan refund maksimal 500 karakter',
        status: 400,
      }
    }

    // Validate tracking number when status is 'shipped'
    if (newStatus === 'shipped') {
      if (!trackingNumber || typeof trackingNumber !== 'string' || trackingNumber.trim().length === 0) {
        return {
          success: false,
          error: 'Nomor resi wajib diisi saat mengubah status ke dikirim',
          status: 400,
        }
      }
      if (trackingNumber.length > 100) {
        return {
          success: false,
          error: 'Nomor resi maksimal 100 karakter',
          status: 400,
        }
      }
    }

    // Find the order with all needed relations
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            storeAvatar: true,
            commissionRate: true,
          },
        },
        shipping: true,
      },
    })

    if (!order) {
      return {
        success: false,
        error: 'Pesanan tidak ditemukan',
        status: 404,
      }
    }

    // Validate state transition
    const allowedNextStatuses = VALID_TRANSITIONS[order.status]
    if (!allowedNextStatuses || !allowedNextStatuses.includes(newStatus)) {
      logger.warn({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: newStatus,
        userId: updatedBy,
      }, 'Invalid order status transition attempted')
      return {
        success: false,
        error: `Tidak dapat mengubah status dari "${order.status}" ke "${newStatus}"`,
        status: 400,
      }
    }

    // Process the status change in a database transaction
    const updatedOrder = await db.$transaction(async (tx) => {
      // Build the order update data
      const orderUpdateData: Record<string, unknown> = { status: newStatus }

      if (newStatus === 'paid') {
        orderUpdateData.paymentStatus = 'paid'
        orderUpdateData.paidAt = new Date()
      } else if (newStatus === 'shipped') {
        orderUpdateData.shippedAt = new Date()
      } else if (newStatus === 'delivered') {
        orderUpdateData.deliveredAt = new Date()
      } else if (newStatus === 'cancelled') {
        orderUpdateData.cancelledAt = new Date()
        orderUpdateData.cancelReason = cancelReason?.trim() || null
        // Apply paymentStatusOverride if provided (e.g. 'expired' for unpaid cancelled orders)
        if (paymentStatusOverride) {
          orderUpdateData.paymentStatus = paymentStatusOverride
        }
      } else if (newStatus === 'refunded') {
        orderUpdateData.cancelledAt = new Date()
        orderUpdateData.cancelReason = cancelReason?.trim() || 'Refunded'
        orderUpdateData.paymentStatus = 'refunded'
      }

      // Update the order
      const result = await tx.order.update({
        where: { id: orderId },
        data: orderUpdateData,
        include: {
          items: true,
          shipping: true,
          seller: {
            select: {
              id: true,
              storeName: true,
              storeAvatar: true,
            },
          },
        },
      })

      // ---- Status-specific logic ----

      if (newStatus === 'shipped') {
        // Update shipping with tracking number
        if (order.shipping) {
          await tx.shipping.update({
            where: { orderId },
            data: {
              trackingNumber: trackingNumber!.trim(),
              status: 'in_transit',
              shippedAt: new Date(),
            },
          })
        }
      }

      if (newStatus === 'delivered') {
        // Update shipping status
        if (order.shipping) {
          await tx.shipping.update({
            where: { orderId },
            data: {
              status: 'delivered',
              deliveredAt: new Date(),
            },
          })
        }

        // Escrow release: move funds from pendingBalance to balance for seller
        const commissionRate = await getEffectiveCommissionRate(Number(order.seller.commissionRate))
        const subtotal = Number(order.subtotal)
        const commissionAmount = Math.round(subtotal * commissionRate)
        const sellerEarnings = subtotal - commissionAmount

        // Find or create seller's wallet (unified — one wallet per user)
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
            balance: updatedWallet.balance,
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
      }

      // Both 'cancelled' and 'refunded' require stock restore, buyer refund, and escrow reversal
      if (newStatus === 'cancelled' || newStatus === 'refunded') {
        // Restore product stock for all order items
        for (const item of order.items) {
          // Get current stock before incrementing
          const currentProduct = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stock: true, name: true },
          })

          // Restore stock and decrement sold count in a single atomic query
          // Uses GREATEST to ensure sold never goes below zero (race condition safety)
          await tx.$executeRaw`
            UPDATE "Product" SET stock = stock + ${item.quantity}, sold = GREATEST(sold - ${item.quantity}, 0) WHERE id = ${item.productId}
          `

          // Log stock change for cancel/refund
          if (currentProduct) {
            await logStockChangeInTx(tx, {
              productId: item.productId,
              variantId: item.variantId || undefined,
              type: newStatus === 'refunded' ? 'return' : 'cancel',
              quantity: item.quantity,
              previousStock: currentProduct.stock,
              newStock: currentProduct.stock + item.quantity,
              reason: `${newStatus === 'refunded' ? 'Refund' : 'Cancel'} order ${order.orderNumber}${cancelReason ? ` - ${cancelReason.trim()}` : ''}`,
              orderId: order.id,
              createdBy: updatedBy,
            })
          }

          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            })
          }
        }

        // If order was paid, process refund and escrow reversal
        if (order.paymentStatus === 'paid') {
          // Refund buyer's wallet
          const buyerWallet = await tx.wallet.findUnique({
            where: { userId: order.userId },
          })

          if (buyerWallet) {
            const refundAmount = Number(order.totalAmount)
            const updatedBuyerWallet = await tx.wallet.update({
              where: { id: buyerWallet.id },
              data: { balance: { increment: refundAmount } },
            })

            // Record wallet mutation for buyer (credit = refund)
            await tx.walletMutation.create({
              data: {
                walletId: buyerWallet.id,
                type: 'credit',
                amount: new Prisma.Decimal(refundAmount),
                balance: updatedBuyerWallet.balance,
                description: `Refund pesanan ${order.orderNumber}`,
                refType: 'refund',
                refId: order.id,
              },
            })
          }

          // Deduct from seller's pending balance (escrow reversal)
          const sellerWallet = await tx.wallet.findUnique({
            where: { userId: order.seller.userId },
          })

          if (sellerWallet) {
            const commissionRate = await getEffectiveCommissionRate(Number(order.seller.commissionRate))
            const subtotal = Number(order.subtotal)
            const commissionAmount = Math.round(subtotal * commissionRate)
            const sellerHoldAmount = subtotal - commissionAmount

            // Deduct from pendingBalance (what was held for seller)
            const deductAmount = Math.min(sellerHoldAmount, Number(sellerWallet.pendingBalance))
            await tx.wallet.update({
              where: { id: sellerWallet.id },
              data: { pendingBalance: { decrement: deductAmount } },
            })

            // Record wallet mutation for seller (debit = escrow reversal)
            await tx.walletMutation.create({
              data: {
                walletId: sellerWallet.id,
                type: 'debit',
                amount: new Prisma.Decimal(deductAmount),
                balance: sellerWallet.balance,
                description: `Pembatalan dana pesanan ${order.orderNumber}`,
                refType: 'refund',
                refId: order.id,
              },
            })
          }

          // Record refund transaction
          await tx.transaction.create({
            data: {
              userId: order.userId,
              type: 'refund',
              amount: order.totalAmount,
              fee: new Prisma.Decimal(0),
              netAmount: order.totalAmount,
              method: 'wallet',
              status: 'success',
              description: `Refund pesanan ${order.orderNumber} - ${cancelReason?.trim() || (newStatus === 'refunded' ? 'Refunded' : 'Dibatalkan')}`,
              refId: order.id,
            },
          })
        }
      }

      return result
    })

    // ---- After successful transaction: send centralized notifications ----
    // Uses sendOrderNotification which handles in-app, email (checks emailNotif), and push (checks FCM)
    // All external notifications are fire-and-forget — failures should NOT break the status update

    const statusToNotifType: Record<string, OrderNotificationType> = {
      paid: 'order_confirmed',
      processing: 'order_processing',
      shipped: 'order_shipped',
      delivered: 'order_delivered',
      cancelled: 'order_cancelled',
      refunded: 'order_cancelled', // refunded uses same notification as cancelled
    }

    const notifType = statusToNotifType[newStatus]
    if (notifType) {
      // Build OrderEmailData for the email templates
      const orderEmailData: OrderEmailData = {
        orderNumber: order.orderNumber,
        userName: order.user?.name || 'Pembeli',
        userEmail: order.user?.email || '',
        items: order.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          price: Number(item.price),
          image: item.image,
        })),
        totalAmount: Number(order.totalAmount),
        shippingCost: Number(order.shippingCost),
        discountAmount: Number(order.discountAmount),
        sellerName: order.seller.storeName,
      }

      // Fire-and-forget — errors are caught inside sendOrderNotification
      sendOrderNotification({
        userId: order.userId,
        type: notifType,
        data: {
          orderNumber: order.orderNumber,
          orderId: order.id,
          trackingNumber: trackingNumber?.trim(),
          cancelReason: cancelReason?.trim(),
          orderData: orderEmailData,
          sellerUserId: order.seller.userId,
        },
      }).catch(() => {
        // Already logged inside sendOrderNotification
      })
    }

    // Log the successful status change
    logger.info({
      orderId: order.id,
      orderNumber: order.orderNumber,
      fromStatus: order.status,
      toStatus: newStatus,
      userId: updatedBy,
      duration: Date.now() - startTime,
    }, 'Order status updated successfully')

    return {
      success: true,
      data: updatedOrder as unknown as Record<string, unknown>,
    }
  } catch (error: unknown) {
    // Handle known business logic errors from the transaction
    if (error instanceof Error) {
      if (error.message.includes('pendingBalance') && error.message.includes('insufficient')) {
        return {
          success: false,
          error: 'Insufficient pending balance for escrow release',
          status: 400,
        }
      }
    }
    logger.error({ err: error }, 'updateOrderStatus error')
    return {
      success: false,
      error: 'Terjadi kesalahan server',
      status: 500,
    }
  }
}
