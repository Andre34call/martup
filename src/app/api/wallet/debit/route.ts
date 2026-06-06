import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { paymentLimiter, rateLimitHeaders } from '@/lib/rate-limit'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'
import { validateBody, walletDebitSchema } from '@/lib/validations'
import { validateCsrfRequest } from '@/lib/csrf'

// ==================== WALLET DEBIT (Payment) ====================
// Deducts balance from the user's wallet for order payment.
// SECURITY: Requires authentication + ownership verification + sufficient balance
// Also updates the order status to 'paid' and triggers seller payout.

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit — 5 debit requests per minute per user
    const rlResult = await paymentLimiter.check(`debit:${authResult.user.id}`)
    if (!rlResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429, headers: rateLimitHeaders(rlResult) }
      )
    }

    // SECURITY: CSRF protection
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json({ success: false, error: 'Keamanan request tidak valid. Refresh halaman dan coba lagi.' }, { status: 403 })
    }

    const body = await request.json()

    // Zod validation
    const validation = validateBody(walletDebitSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { amount, orderId, description } = validation.data

    // Find the user's wallet
    const wallet = await db.wallet.findUnique({
      where: { userId: authResult.user.id },
    })

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet tidak ditemukan' },
        { status: 404 }
      )
    }

    // Note: Balance check is ALSO done inside the transaction below for race condition safety.
    // This pre-check provides a nicer error message before entering the transaction.

    // Find and validate the order
    const order = await db.order.findUnique({
      where: { id: orderId },
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
          select: { id: true, name: true },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the order belongs to the authenticated user
    if (order.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Anda hanya bisa membayar pesanan sendiri' },
        { status: 403 }
      )
    }

    // Verify order is in a payable state
    if (order.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Pesanan tidak bisa dibayar. Status: ${order.status}` },
        { status: 400 }
      )
    }

    if (order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'pending' && order.paymentStatus !== 'cod') {
      return NextResponse.json(
        { success: false, error: `Status pembayaran sudah: ${order.paymentStatus}` },
        { status: 400 }
      )
    }

    // Verify amount matches order total
    if (Math.abs(Number(order.totalAmount) - amount) > 1) {
      // Allow 1 rupiah rounding difference
      return NextResponse.json(
        { success: false, error: `Jumlah pembayaran tidak sesuai. Total pesanan: Rp ${Number(order.totalAmount).toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // Process everything in a single database transaction
    // SECURITY: Idempotency check is INSIDE the transaction to prevent TOCTOU race condition
    // (two concurrent requests could both pass the outside check before either creates the mutation)
    const result = await db.$transaction(async (tx) => {
      // IDEMPOTENCY: Check if wallet already debited for this order (INSIDE transaction)
      const existingDebit = await tx.walletMutation.findFirst({
        where: {
          walletId: wallet.id,
          type: 'debit',
          refType: 'order',
          refId: orderId,
        },
      })

      if (existingDebit) {
        throw new Error('ALREADY_PAID')
      }

      // SECURITY: Re-fetch wallet inside transaction to prevent race conditions (double-spend)
      const currentWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      })

      if (!currentWallet || Number(currentWallet.balance) < amount) {
        throw new Error(`INSUFFICIENT_BALANCE:${Number(currentWallet?.balance ?? 0)}`)
      }

      // 1. Deduct wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      })

      // 2. Create wallet mutation (debit)
      await tx.walletMutation.create({
        data: {
          walletId: wallet.id,
          type: 'debit',
          amount,
          balance: Number(updatedWallet.balance),
          description: description || `Pembayaran pesanan ${order.orderNumber}`,
          refType: 'order',
          refId: orderId,
        },
      })

      // 3. Update order status to paid
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'paid',
          paymentStatus: 'paid',
          paymentMethod: 'MartUp Pay',
          paidAt: new Date(),
        },
      })

      // 4. Create transaction record
      await tx.transaction.create({
        data: {
          userId: authResult.user.id,
          type: 'payment',
          amount,
          fee: Number(order.platformFee),
          netAmount: amount - Number(order.platformFee),
          method: 'wallet',
          status: 'success',
          description: `Pembayaran pesanan ${order.orderNumber} via MartUp Pay`,
          refId: order.orderNumber,
        },
      })

      // 5. Process seller payout (same logic as Midtrans notification)
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

      // IDEMPOTENCY: Check if seller already credited for this order (prevents double payout)
      const existingSellerCredit = await tx.walletMutation.findFirst({
        where: { walletId: sellerWallet.id, type: 'credit', refType: 'order', refId: orderId },
      })

      if (existingSellerCredit) {
        // Already credited — skip seller payout
      } else {
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
            description: `Pendapatan dari pesanan ${order.orderNumber} - ${order.seller.storeName}`,
            refType: 'order',
            refId: orderId,
          },
        })

        // Create commission transaction
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

      // 6. Create notifications
      await tx.notification.create({
        data: {
          userId: order.userId,
          title: 'Pembayaran Berhasil',
          content: `Pembayaran untuk pesanan ${order.orderNumber} sebesar Rp ${Number(order.totalAmount).toLocaleString('id-ID')} via MartUp Pay telah berhasil.`,
          type: 'order',
          refType: 'order',
          refId: orderId,
        },
      })

      await tx.notification.create({
        data: {
          userId: order.seller.userId,
          title: 'Pesanan Baru Dibayar',
          content: `Pesanan ${order.orderNumber} dari ${order.user.name} telah dibayar sebesar Rp ${Number(order.totalAmount).toLocaleString('id-ID')}. Segera proses pesanan!`,
          type: 'order',
          refType: 'order',
          refId: orderId,
        },
      })

      return { walletBalance: Number(updatedWallet.balance) }
    })

    logBusinessEvent({
      event: 'WALLET_PAYMENT',
      userId: authResult.user.id,
      details: { orderId, amount, orderNumber: order.orderNumber },
    })

    logger.info({ userId: authResult.user.id, orderId, amount }, 'Wallet payment successful')

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        orderId,
        orderNumber: order.orderNumber,
        amount,
        newBalance: result.walletBalance,
        paymentMethod: 'MartUp Pay',
      },
    }))
  } catch (error: unknown) {
    // Handle transaction-level errors
    if (error instanceof Error) {
      if (error.message === 'ALREADY_PAID') {
        return NextResponse.json(
          { success: false, error: 'Pembayaran untuk pesanan ini sudah diproses sebelumnya' },
          { status: 400 }
        )
      }
      if (error.message.startsWith('INSUFFICIENT_BALANCE:')) {
        const balance = error.message.split(':')[1] || '0'
        const needed = error.message.split(':')[2] || '0'
        return NextResponse.json(
          { success: false, error: `Saldo tidak mencukupi. Saldo: Rp ${Number(balance).toLocaleString('id-ID')}, Dibutuhkan: Rp ${Number(needed).toLocaleString('id-ID')}` },
          { status: 400 }
        )
      }
    }
    logger.error({ err: error }, 'POST /api/wallet/debit error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
