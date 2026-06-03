import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'
import { validateCsrfRequest } from '@/lib/csrf'

// ==================== PUT /api/admin/orders/[id]/verify-payment ====================
// Admin verifies or rejects a buyer's payment proof

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Verify admin authentication
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 1.5: CSRF protection
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json(
        { success: false, error: 'CSRF validation failed. Silakan refresh halaman dan coba lagi.' },
        { status: 403 }
      )
    }

    const { id: orderId } = await params

    // Step 2: Parse request body
    const body = await request.json()
    const { action, adminNote } = body as {
      action: 'approve' | 'reject'
      adminNote?: string
    }

    // Validate action
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Aksi tidak valid. Gunakan "approve" atau "reject".' },
        { status: 400 }
      )
    }

    // Validate adminNote if provided
    if (adminNote !== undefined && adminNote !== null && typeof adminNote !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Catatan admin harus berupa teks' },
        { status: 400 }
      )
    }

    if (adminNote && adminNote.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Catatan admin maksimal 1000 karakter' },
        { status: 400 }
      )
    }

    // Step 3: Find the order
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            commissionRate: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Step 4: Order must have paymentStatus "pending_verification"
    if (order.paymentStatus !== 'pending_verification') {
      return NextResponse.json(
        { success: false, error: `Status pembayaran pesanan adalah "${order.paymentStatus}", bukan "pending_verification". Verifikasi tidak dapat dilakukan.` },
        { status: 400 }
      )
    }

    // Step 5: Process the action in a transaction
    const updatedOrder = await db.$transaction(async (tx) => {
      if (action === 'approve') {
        // APPROVE: Set payment as paid, update order status, credit seller's pending balance

        const now = new Date()

        // Update order status
        const result = await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'paid',
            status: 'paid',
            paidAt: now,
            escrowStatus: 'held',
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: true,
                    slug: true,
                  },
                },
                variant: true,
              },
            },
            shipping: true,
            seller: {
              select: {
                id: true,
                storeName: true,
                storeSlug: true,
                storeAvatar: true,
              },
            },
            platformBankAccount: true,
          },
        })

        // Credit seller's pending balance (escrow holds the money)
        // Seller receives: subtotal - commission
        const subtotal = Number(order.subtotal)
        const commissionRate = Number(order.seller.commissionRate)
        const commission = Math.floor(subtotal * commissionRate)
        const sellerEarnings = subtotal - commission

        // Find or create seller wallet
        let sellerWallet = await tx.wallet.findUnique({
          where: { sellerId: order.sellerId },
        })

        if (!sellerWallet) {
          sellerWallet = await tx.wallet.create({
            data: {
              sellerId: order.sellerId,
              userId: order.seller.userId,
              pendingBalance: sellerEarnings,
            },
          })
        } else {
          sellerWallet = await tx.wallet.update({
            where: { id: sellerWallet.id },
            data: {
              pendingBalance: { increment: sellerEarnings },
            },
          })
        }

        // Record wallet mutation
        await tx.walletMutation.create({
          data: {
            walletId: sellerWallet.id,
            type: 'credit',
            amount: sellerEarnings,
            balance: sellerWallet.pendingBalance,
            description: `Pembayaran diterima untuk pesanan ${order.orderNumber} (escrow) — komisi ${commissionRate * 100}%`,
            refType: 'order',
            refId: orderId,
          },
        })

        // Create notification for buyer
        await tx.notification.create({
          data: {
            userId: order.userId,
            title: 'Pembayaran Diverifikasi',
            content: `Pembayaran untuk pesanan ${order.orderNumber} telah diverifikasi. Penjual akan segera memproses pesanan Anda.${adminNote ? ` Catatan admin: ${adminNote}` : ''}`,
            type: 'order',
            refType: 'order',
            refId: orderId,
          },
        })

        // Create notification for seller
        await tx.notification.create({
          data: {
            userId: order.seller.userId,
            title: 'Pesanan Baru Dibayar',
            content: `Pembayaran untuk pesanan ${order.orderNumber} telah diverifikasi. Silakan proses pesanan segera.${adminNote ? ` Catatan admin: ${adminNote}` : ''}`,
            type: 'order',
            refType: 'order',
            refId: orderId,
          },
        })

        logBusinessEvent({
          event: 'PAYMENT_APPROVED',
          userId: authResult.user.id,
          details: {
            orderId,
            orderNumber: order.orderNumber,
            subtotal,
            commission,
            sellerEarnings,
            adminNote,
          },
        })

        return result
      } else {
        // REJECT: Set payment as failed, reset escrow status

        const result = await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'failed',
            escrowStatus: 'none',
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: true,
                    slug: true,
                  },
                },
                variant: true,
              },
            },
            shipping: true,
            seller: {
              select: {
                id: true,
                storeName: true,
                storeSlug: true,
                storeAvatar: true,
              },
            },
            platformBankAccount: true,
          },
        })

        // Create notification for buyer
        await tx.notification.create({
          data: {
            userId: order.userId,
            title: 'Pembayaran Ditolak',
            content: `Bukti pembayaran untuk pesanan ${order.orderNumber} ditolak.${adminNote ? ` Alasan: ${adminNote}` : ' Silakan hubungi admin untuk informasi lebih lanjut.'}`,
            type: 'order',
            refType: 'order',
            refId: orderId,
          },
        })

        logBusinessEvent({
          event: 'PAYMENT_REJECTED',
          userId: authResult.user.id,
          details: {
            orderId,
            orderNumber: order.orderNumber,
            adminNote,
          },
        })

        return result
      }
    })

    return NextResponse.json(
      serializeDecimal({ success: true, data: updatedOrder })
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'PUT /api/admin/orders/[id]/verify-payment error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
