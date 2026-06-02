import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

// ==================== Valid Status Transitions ====================
// pending → cancelled (buyer or admin)
// pending → paid (admin only, or via payment webhook)
// paid → processing (seller only)
// paid → shipped (seller only; physical: requires trackingNumber; service: requires serviceProofImages)
// paid → cancelled (seller or admin)
// processing → shipped (seller only; physical: requires trackingNumber; service: requires serviceProofImages)
// processing → cancelled (seller or admin)
// shipped → delivered (buyer only, triggers escrow release; service: buyer confirmed OR auto-confirmed)
// shipped → cancelled (admin only, triggers refund)
//
// Service order flow: paid → processing (seller working) → shipped (seller submitted proof = "Jasa Selesai")
//   → delivered (buyer confirmed OR auto-confirmed after autoConfirmAt deadline)
// Physical order flow: paid → processing → shipped (requires trackingNumber) → delivered (buyer confirms receipt)

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['cancelled', 'paid'],
  paid: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
}

const VALID_STATUSES = ['processing', 'shipped', 'delivered', 'cancelled', 'paid']

/**
 * Read commissionRate from PlatformSetting table.
 * Falls back to the seller's stored commissionRate, then to 0.05 default.
 * For service orders, reads serviceCommissionRate first (default 0.08).
 */
async function getCommissionRate(isServiceOrder = false): Promise<number> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: 'platform_settings' } })
    if (row) {
      const settings = JSON.parse(row.value) as Record<string, number | boolean | string>
      if (isServiceOrder) {
        // Service orders: higher commission rate to protect marketplace from service fraud
        if (typeof settings.serviceCommissionRate === 'number' && settings.serviceCommissionRate >= 0 && settings.serviceCommissionRate < 1) {
          return settings.serviceCommissionRate
        }
      }
      if (typeof settings.commissionRate === 'number' && settings.commissionRate >= 0 && settings.commissionRate < 1) {
        return settings.commissionRate
      }
    }
  } catch {
    // Fallback to default
  }
  return isServiceOrder ? 0.08 : 0.05
}

/**
 * Shared order status update logic.
 *
 * Extracted from /api/orders/[id]/status to avoid the admin route
 * self-fetching via HTTP (SSRF risk, fragile in serverless, CSRF token
 * consumption issues).
 *
 * @param params.orderId           The order ID to update
 * @param params.status            The target status
 * @param params.cancelReason      Required when status is 'cancelled'
 * @param params.trackingNumber    Required when status is 'shipped' for physical orders
 * @param params.serviceProofImages Required when status is 'shipped' for service orders
 * @param params.authUserId        The authenticated user's ID
 * @param params.authUserRole      The authenticated user's role
 */
export async function updateOrderStatus(params: {
  orderId: string
  status: string
  cancelReason?: string
  trackingNumber?: string
  serviceProofImages?: string[] // Required for service orders when status is 'shipped'
  authUserId: string
  authUserRole: string
}): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
  const { orderId, status, cancelReason, trackingNumber, serviceProofImages, authUserId, authUserRole } = params

  // ---- Input validation ----

  if (!status) {
    return { success: false, error: 'Status wajib diisi', status: 400 }
  }

  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: `Status tidak valid. Pilihan: ${VALID_STATUSES.join(', ')}`, status: 400 }
  }

  // Validate cancelReason when status is 'cancelled'
  if (status === 'cancelled') {
    if (!cancelReason || typeof cancelReason !== 'string' || cancelReason.trim().length === 0) {
      return { success: false, error: 'Alasan pembatalan wajib diisi saat membatalkan pesanan', status: 400 }
    }
    if (cancelReason.length > 500) {
      return { success: false, error: 'Alasan pembatalan maksimal 500 karakter', status: 400 }
    }
  }

  // Pre-fetch validation for trackingNumber (only length check; presence is validated after order fetch)
  if (status === 'shipped' && trackingNumber && trackingNumber.length > 100) {
    return { success: false, error: 'Nomor resi maksimal 100 karakter', status: 400 }
  }

  // ---- Find the order with all needed relations ----

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
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
      shipping: true,
    },
  })

  if (!order) {
    return { success: false, error: 'Pesanan tidak ditemukan', status: 404 }
  }

  const isServiceOrder = order.isServiceOrder

  // ---- Service-aware validation for 'shipped' status ----
  if (status === 'shipped') {
    if (isServiceOrder) {
      // Service orders require proof images instead of tracking number
      if (!serviceProofImages || !Array.isArray(serviceProofImages) || serviceProofImages.length === 0) {
        return { success: false, error: 'Bukti penyelesaian jasa wajib diisi saat mengubah status ke selesai', status: 400 }
      }
    } else {
      // Physical orders require tracking number
      if (!trackingNumber || typeof trackingNumber !== 'string' || trackingNumber.trim().length === 0) {
        return { success: false, error: 'Nomor resi wajib diisi saat mengubah status ke dikirim', status: 400 }
      }
    }
  }

  // ---- Validate state transition ----

  const allowedNextStatuses = VALID_TRANSITIONS[order.status]
  if (!allowedNextStatuses || !allowedNextStatuses.includes(status)) {
    logger.warn({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: status,
      userId: authUserId,
    }, 'Invalid order status transition attempted')
    return { success: false, error: `Tidak dapat mengubah status dari "${order.status}" ke "${status}"`, status: 400 }
  }

  // ---- Determine user roles relative to this order ----

  const isBuyer = order.userId === authUserId
  const seller = await db.seller.findUnique({
    where: { userId: authUserId },
    select: { id: true },
  })
  const isSeller = seller !== null && order.sellerId === seller.id
  const isAdmin = ['admin', 'manager'].includes(authUserRole)

  // ---- Authorization checks — who can set which status ----

  if (status === 'cancelled') {
    if (order.status === 'pending') {
      if (!isBuyer && !isAdmin) {
        return { success: false, error: 'Hanya pembeli atau admin yang dapat membatalkan pesanan', status: 403 }
      }
    } else if (order.status === 'paid' || order.status === 'processing') {
      if (!isSeller && !isAdmin) {
        return { success: false, error: 'Hanya penjual atau admin yang dapat membatalkan pesanan yang sudah dibayar', status: 403 }
      }
    } else if (order.status === 'shipped') {
      if (!isAdmin) {
        return { success: false, error: 'Hanya admin yang dapat membatalkan pesanan yang sudah dikirim', status: 403 }
      }
    }
  } else if (status === 'paid') {
    if (!isAdmin) {
      return { success: false, error: 'Hanya admin yang dapat menandai pesanan sebagai dibayar', status: 403 }
    }
  } else if (status === 'processing') {
    if (!isSeller) {
      return { success: false, error: 'Hanya penjual yang dapat mengubah status menjadi diproses', status: 403 }
    }
  } else if (status === 'shipped') {
    if (!isSeller) {
      return { success: false, error: 'Hanya penjual yang dapat mengubah status menjadi dikirim', status: 403 }
    }
  } else if (status === 'delivered') {
    if (!isBuyer) {
      return { success: false, error: 'Hanya pembeli yang dapat mengkonfirmasi penerimaan pesanan', status: 403 }
    }
  }

  // Ensure user has some relationship to the order
  if (!isBuyer && !isSeller && !isAdmin) {
    return { success: false, error: 'Anda tidak memiliki akses ke pesanan ini', status: 403 }
  }

  // ---- Process the status change in a database transaction ----

  try {
    const updatedOrder = await db.$transaction(async (tx) => {
      // Build the order update data
      const orderUpdateData: Record<string, unknown> = { status }

      if (status === 'paid') {
        orderUpdateData.paymentStatus = 'paid'
        orderUpdateData.paidAt = new Date()
      } else if (status === 'shipped') {
        orderUpdateData.shippedAt = new Date()
        if (isServiceOrder) {
          // Service order: seller marks service as complete
          orderUpdateData.serviceProofImages = JSON.stringify(serviceProofImages)
          orderUpdateData.sellerCompletedAt = new Date()
          // Auto-confirm after 3 days (72 hours) if buyer doesn't respond
          // CRON JOB HINT: A cron job should check orders where autoConfirmAt <= now
          // and status = 'shipped' and isServiceOrder = true, then auto-confirm them
          // by calling updateOrderStatus with status='delivered' and a system user.
          orderUpdateData.autoConfirmAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
        }
      } else if (status === 'delivered') {
        orderUpdateData.deliveredAt = new Date()
        // Service order: record buyer confirmation time
        if (isServiceOrder) {
          orderUpdateData.buyerConfirmedAt = new Date()
        }
      } else if (status === 'cancelled') {
        orderUpdateData.cancelledAt = new Date()
        orderUpdateData.cancelReason = cancelReason?.trim() || null
        // SECURITY (SG-5): Mark payment as refunded when cancelling a paid order
        if (order.paymentStatus === 'paid') {
          orderUpdateData.paymentStatus = 'refunded'
        }
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

      if (status === 'shipped') {
        // Physical orders: update shipping with tracking number
        // Service orders: skip shipping update (may not have a shipping record)
        if (!isServiceOrder && order.shipping) {
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

      if (status === 'delivered') {
        // Update shipping status (skip for service orders with no shipping record)
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
        // Service orders use a higher commission rate (serviceCommissionRate) to protect against fraud
        const platformCommissionRate = await getCommissionRate(isServiceOrder)
        const sellerCommissionRate = Number(order.seller.commissionRate)
        const defaultRate = isServiceOrder ? 0.08 : 0.05
        const commissionRate = platformCommissionRate || sellerCommissionRate || defaultRate
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
      }

      if (status === 'cancelled') {
        // Restore product stock for all order items
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              sold: { decrement: item.quantity },
            },
          })

          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            })
          }
        }

        // If order was paid, process refund
        if (order.paymentStatus === 'paid') {
          // BUG 9 FIX: Only refund to buyer's wallet when paymentMethod === 'wallet'
          // For other payment methods (Midtrans), only the Midtrans refund is requested
          // (handled outside the transaction below) — NOT both wallet credit AND Midtrans refund
          if (order.paymentMethod === 'wallet') {
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
                  balance: new Prisma.Decimal(Number(updatedBuyerWallet.balance)),
                  description: `Refund pesanan ${order.orderNumber}`,
                  refType: 'refund',
                  refId: order.id,
                },
              })
            }
          }

          // Deduct from seller's pending balance (escrow reversal)
          const sellerWallet = await tx.wallet.findUnique({
            where: { sellerId: order.sellerId },
          })

          if (sellerWallet) {
            const platformCommissionRate = await getCommissionRate(isServiceOrder)
            const sellerCommissionRate = Number(order.seller.commissionRate)
            const defaultRate = isServiceOrder ? 0.08 : 0.05
            const commissionRate = platformCommissionRate || sellerCommissionRate || defaultRate
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
                balance: new Prisma.Decimal(Number(sellerWallet.balance)),
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
              description: `Refund pesanan ${order.orderNumber} - ${cancelReason?.trim() || 'Dibatalkan'}`,
              refId: order.id,
            },
          })
        }
      }

      // Create notifications for both buyer and seller
      const notificationMap: Record<string, { buyerTitle: string; buyerContent: string; sellerTitle: string; sellerContent: string }> = {
        paid: {
          buyerTitle: 'Pembayaran Berhasil',
          buyerContent: `Pembayaran untuk pesanan ${order.orderNumber} telah dikonfirmasi.`,
          sellerTitle: 'Pesanan Baru Dibayar',
          sellerContent: `Pesanan ${order.orderNumber} telah dibayar. Segera proses pesanan!`,
        },
        processing: {
          buyerTitle: 'Pesanan Sedang Diproses',
          buyerContent: `Pesanan ${order.orderNumber} sedang diproses oleh penjual.`,
          sellerTitle: 'Pesanan Diproses',
          sellerContent: `Pesanan ${order.orderNumber} telah Anda tandai sebagai diproses.`,
        },
        shipped: isServiceOrder
          ? {
              buyerTitle: 'Jasa Selesai',
              buyerContent: `Pesanan jasa ${order.orderNumber} telah diselesaikan oleh penjual. Silakan konfirmasi dalam 3 hari atau akan dikonfirmasi otomatis.`,
              sellerTitle: 'Jasa Ditandai Selesai',
              sellerContent: `Pesanan jasa ${order.orderNumber} telah Anda tandai sebagai selesai. Menunggu konfirmasi pembeli (otomatis dalam 3 hari).`,
            }
          : {
              buyerTitle: 'Pesanan Dikirim',
              buyerContent: `Pesanan ${order.orderNumber} telah dikirim. Nomor resi: ${trackingNumber?.trim() || '-'}.`,
              sellerTitle: 'Pesanan Dikirim',
              sellerContent: `Pesanan ${order.orderNumber} telah Anda tandai sebagai dikirim. Nomor resi: ${trackingNumber?.trim() || '-'}.`,
            },
        delivered: {
          buyerTitle: 'Pesanan Diterima',
          buyerContent: `Pesanan ${order.orderNumber} telah dikonfirmasi diterima. Dana penjual telah dicairkan.`,
          sellerTitle: 'Dana Pesanan Dicairkan',
          sellerContent: `Pembeli telah mengkonfirmasi penerimaan pesanan ${order.orderNumber}. Dana telah dicairkan ke saldo Anda.`,
        },
        cancelled: {
          buyerTitle: 'Pesanan Dibatalkan',
          buyerContent: `Pesanan ${order.orderNumber} telah dibatalkan. Alasan: ${cancelReason?.trim() || '-'}`,
          sellerTitle: 'Pesanan Dibatalkan',
          sellerContent: `Pesanan ${order.orderNumber} telah dibatalkan. Alasan: ${cancelReason?.trim() || '-'}`,
        },
      }

      const notifData = notificationMap[status]
      if (notifData) {
        // Notify buyer
        await tx.notification.create({
          data: {
            userId: order.userId,
            title: notifData.buyerTitle,
            content: notifData.buyerContent,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })

        // Notify seller
        await tx.notification.create({
          data: {
            userId: order.seller.userId,
            title: notifData.sellerTitle,
            content: notifData.sellerContent,
            type: 'order',
            refType: 'order',
            refId: order.id,
          },
        })
      }

      return result
    })

    // SECURITY (SG-5): If order was cancelled and paid via Midtrans (not wallet), request refund from Midtrans
    if (status === 'cancelled' && order.paymentStatus === 'paid' && order.paymentMethod && order.paymentMethod !== 'wallet') {
      try {
        const { requestMidtransRefund } = await import('@/lib/midtrans-server')
        const refundResult = await requestMidtransRefund(
          order.orderNumber,
          Number(order.totalAmount),
          cancelReason || 'Order cancelled'
        )
        if (refundResult.success) {
          logger.info({ orderId: order.id, orderNumber: order.orderNumber }, 'Midtrans refund requested')
        } else {
          logger.warn({ orderId: order.id, orderNumber: order.orderNumber, error: refundResult.message }, 'Midtrans refund failed — manual refund may be needed')
        }
      } catch (refundError) {
        logger.error({ err: refundError, orderId: order.id }, 'Midtrans refund exception')
      }
    }

    // Log the successful status change
    logger.info({
      orderId: order.id,
      orderNumber: order.orderNumber,
      fromStatus: order.status,
      toStatus: status,
      userId: authUserId,
      userRole: authUserRole,
      isServiceOrder,
    }, 'Order status updated successfully')

    return { success: true, data: updatedOrder }
  } catch (error: unknown) {
    // Handle known business logic errors from the transaction
    if (error instanceof Error) {
      if (error.message.includes('pendingBalance') && error.message.includes('insufficient')) {
        return { success: false, error: 'Insufficient pending balance for escrow release', status: 400 }
      }
    }
    logger.error({ err: error }, 'updateOrderStatus transaction error')
    return { success: false, error: 'Terjadi kesalahan server', status: 500 }
  }
}
