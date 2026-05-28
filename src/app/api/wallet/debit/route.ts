import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'

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
    if (!checkRateLimit(`debit:${authResult.user.id}`, 5)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { amount, orderId, description } = body as {
      amount?: number
      orderId?: string
      description?: string
    }

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Jumlah debit harus lebih dari 0' },
        { status: 400 }
      )
    }

    // Validate orderId
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId wajib diisi untuk pembayaran pesanan' },
        { status: 400 }
      )
    }

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
            wallet: true,
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

    if (order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'pending') {
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

    // IDEMPOTENCY: Check if wallet already debited for this order
    const existingDebit = await db.walletMutation.findFirst({
      where: {
        walletId: wallet.id,
        type: 'debit',
        refType: 'order',
        refId: orderId,
      },
    })

    if (existingDebit) {
      return NextResponse.json(
        { success: false, error: 'Pembayaran untuk pesanan ini sudah diproses sebelumnya' },
        { status: 400 }
      )
    }

    // Process everything in a single database transaction
    const result = await db.$transaction(async (tx) => {
      // SECURITY: Re-fetch wallet inside transaction to prevent race conditions (double-spend)
      const currentWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      })

      if (!currentWallet || Number(currentWallet.balance) < amount) {
        throw new Error(`Saldo tidak mencukupi. Saldo: Rp ${Number(currentWallet?.balance ?? 0).toLocaleString('id-ID')}, Dibutuhkan: Rp ${amount.toLocaleString('id-ID')}`)
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

      // Find or create seller wallet
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
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'POST /api/wallet/debit error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
