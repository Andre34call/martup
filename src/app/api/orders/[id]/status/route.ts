import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

// ==================== Valid Status Transitions ====================
// pending → cancelled (buyer or admin)
// pending → paid (admin only, or via payment webhook)
// paid → processing (seller only)
// paid → shipped (seller only, requires trackingNumber)
// paid → cancelled (seller or admin)
// processing → shipped (seller only, requires trackingNumber)
// processing → cancelled (seller or admin)
// shipped → delivered (buyer only, triggers escrow release)
// shipped → cancelled (admin only, triggers refund)

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
 */
async function getCommissionRate(): Promise<number> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: 'platform_settings' } })
    if (row) {
      const settings = JSON.parse(row.value) as Record<string, number | boolean | string>
      if (typeof settings.commissionRate === 'number' && settings.commissionRate >= 0 && settings.commissionRate < 1) {
        return settings.commissionRate
      }
    }
  } catch {
    // Fallback to default
  }
  return 0.05
}

// ==================== PUT /api/orders/[id]/status ====================
// Update order status with full authentication, authorization, and transaction safety

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 2: Rate limit — 10 status updates per minute per user
    const rateLimitId = `order-status-put-${authResult.user.id}`
    if (!checkRateLimit(rateLimitId, 10)) {
      logger.warn({ userId: authResult.user.id }, 'Order status update rate limit exceeded')
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 10 status updates per minute.' },
        { status: 429 }
      )
    }

    // Step 3: Parse and validate request body
    const { id } = await params
    const body = await request.json()
    const { status, cancelReason, trackingNumber } = body as {
      status?: string
      cancelReason?: string
      trackingNumber?: string
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status wajib diisi' },
        { status: 400 }
      )
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Status tidak valid. Pilihan: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate cancelReason when status is 'cancelled'
    if (status === 'cancelled') {
      if (!cancelReason || typeof cancelReason !== 'string' || cancelReason.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Alasan pembatalan wajib diisi saat membatalkan pesanan' },
          { status: 400 }
        )
      }
      if (cancelReason.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Alasan pembatalan maksimal 500 karakter' },
          { status: 400 }
        )
      }
    }

    // Validate trackingNumber when status is 'shipped'
    if (status === 'shipped') {
      if (!trackingNumber || typeof trackingNumber !== 'string' || trackingNumber.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Nomor resi wajib diisi saat mengubah status ke dikirim' },
          { status: 400 }
        )
      }
      if (trackingNumber.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Nomor resi maksimal 100 karakter' },
          { status: 400 }
        )
      }
    }

    // Step 4: Find the order with all needed relations
    const order = await db.order.findUnique({
      where: { id },
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
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Step 5: Validate state transition
    const allowedNextStatuses = VALID_TRANSITIONS[order.status]
    if (!allowedNextStatuses || !allowedNextStatuses.includes(status)) {
      logger.warn({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: status,
        userId: authResult.user.id,
      }, 'Invalid order status transition attempted')
      return NextResponse.json(
        { success: false, error: `Tidak dapat mengubah status dari "${order.status}" ke "${status}"` },
        { status: 400 }
      )
    }

    // Step 6: Determine user roles relative to this order
    const isBuyer = order.userId === authResult.user.id
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
      select: { id: true },
    })
    const isSeller = seller !== null && order.sellerId === seller.id
    const isAdmin = ['admin', 'manager'].includes(authResult.user.role)

    // Step 7: Authorization checks — who can set which status
    if (status === 'cancelled') {
      // Buyer can cancel their own order if still pending
      // Seller can cancel paid/processing orders if they can't fulfill
      // Admin can cancel any order for dispute resolution
      if (order.status === 'pending') {
        if (!isBuyer && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Hanya pembeli atau admin yang dapat membatalkan pesanan' },
            { status: 403 }
          )
        }
      } else if (order.status === 'paid' || order.status === 'processing') {
        if (!isSeller && !isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Hanya penjual atau admin yang dapat membatalkan pesanan yang sudah dibayar' },
            { status: 403 }
          )
        }
      } else if (order.status === 'shipped') {
        if (!isAdmin) {
          return NextResponse.json(
            { success: false, error: 'Hanya admin yang dapat membatalkan pesanan yang sudah dikirim' },
            { status: 403 }
          )
        }
      }
    } else if (status === 'paid') {
      // Only admin can manually mark as paid (payment webhook is separate)
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Hanya admin yang dapat menandai pesanan sebagai dibayar' },
          { status: 403 }
        )
      }
    } else if (status === 'processing') {
      // Only the seller of this order can set processing
      if (!isSeller) {
        return NextResponse.json(
          { success: false, error: 'Hanya penjual yang dapat mengubah status menjadi diproses' },
          { status: 403 }
        )
      }
    } else if (status === 'shipped') {
      // Only the seller of this order can set shipped
      if (!isSeller) {
        return NextResponse.json(
          { success: false, error: 'Hanya penjual yang dapat mengubah status menjadi dikirim' },
          { status: 403 }
        )
      }
    } else if (status === 'delivered') {
      // Only the buyer can confirm receipt
      if (!isBuyer) {
        return NextResponse.json(
          { success: false, error: 'Hanya pembeli yang dapat mengkonfirmasi penerimaan pesanan' },
          { status: 403 }
        )
      }
    }

    // Ensure user has some relationship to the order
    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke pesanan ini' },
        { status: 403 }
      )
    }

    // Step 8: Process the status change in a database transaction
    const updatedOrder = await db.$transaction(async (tx) => {
      // Build the order update data
      const orderUpdateData: Record<string, unknown> = { status }

      if (status === 'paid') {
        orderUpdateData.paymentStatus = 'paid'
        orderUpdateData.paidAt = new Date()
      } else if (status === 'shipped') {
        orderUpdateData.shippedAt = new Date()
      } else if (status === 'delivered') {
        orderUpdateData.deliveredAt = new Date()
      } else if (status === 'cancelled') {
        orderUpdateData.cancelledAt = new Date()
        orderUpdateData.cancelReason = cancelReason?.trim() || null
      }

      // Update the order
      const result = await tx.order.update({
        where: { id },
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
        // Update shipping with tracking number
        if (order.shipping) {
          await tx.shipping.update({
            where: { orderId: id },
            data: {
              trackingNumber: trackingNumber!.trim(),
              status: 'in_transit',
              shippedAt: new Date(),
            },
          })
        }
      }

      if (status === 'delivered') {
        // Update shipping status
        if (order.shipping) {
          await tx.shipping.update({
            where: { orderId: id },
            data: {
              status: 'delivered',
              deliveredAt: new Date(),
            },
          })
        }

        // Escrow release: move funds from pendingBalance to balance for seller
        // Calculate commission using PlatformSetting first, then seller's rate, then default
        const platformCommissionRate = await getCommissionRate()
        const sellerCommissionRate = Number(order.seller.commissionRate)
        const commissionRate = platformCommissionRate || sellerCommissionRate || 0.05
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
                balance: new Prisma.Decimal(Number(updatedBuyerWallet.balance)),
                description: `Refund pesanan ${order.orderNumber}`,
                refType: 'refund',
                refId: order.id,
              },
            })
          }

          // Deduct from seller's pending balance (escrow reversal)
          const sellerWallet = await tx.wallet.findUnique({
            where: { sellerId: order.sellerId },
          })

          if (sellerWallet) {
            const platformCommissionRate = await getCommissionRate()
            const sellerCommissionRate = Number(order.seller.commissionRate)
            const commissionRate = platformCommissionRate || sellerCommissionRate || 0.05
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
        shipped: {
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

    // Log the successful status change
    logger.info({
      orderId: order.id,
      orderNumber: order.orderNumber,
      fromStatus: order.status,
      toStatus: status,
      userId: authResult.user.id,
      userRole: authResult.user.role,
      duration: Date.now() - startTime,
    }, 'Order status updated successfully')

    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: updatedOrder,
      })
    )
  } catch (error: unknown) {
    // Handle known business logic errors from the transaction
    if (error instanceof Error) {
      if (error.message.includes('pendingBalance') && error.message.includes('insufficient')) {
        return NextResponse.json(
          { success: false, error: 'Insufficient pending balance for escrow release' },
          { status: 400 }
        )
      }
    }
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    logger.error({ err: error }, 'PUT /api/orders/[id]/status error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
