import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'
import { validateBody, walletDebitBatchSchema } from '@/lib/validations'
import { validateCsrfRequest } from '@/lib/csrf'
import { getEffectiveCommissionRate } from '@/lib/commission'
import { invalidateUserDataCache } from '@/app/api/user-data/route'

// Rate limiter: 3 wallet debit batch requests per minute per user
const debitBatchLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3, keyPrefix: 'rl:wallet:debit-batch:' })

// ==================== WALLET DEBIT BATCH (Atomic Multi-Order Payment) ====================
// Deducts balance from the user's wallet for multiple orders in a SINGLE transaction.
// Either ALL debits succeed or ALL fail — no partial payments.
// This prevents the double-spend and partial-payment bugs that occur when debiting
// each order separately via /api/wallet/debit.

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: CSRF protection
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json(
        { success: false, error: 'CSRF validation failed. Silakan refresh halaman dan coba lagi.' },
        { status: 403 }
      )
    }

    // SECURITY: Rate limit — 3 batch requests per minute per user
    const rateLimit = await debitBatchLimiter.check(authResult.user.id)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    const body = await request.json()

    // Zod validation
    const validation = validateBody(walletDebitBatchSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { orders, description } = validation.data

    // Calculate total amount to debit
    const totalDebitAmount = orders.reduce((sum, o) => sum + o.amount, 0)

    if (totalDebitAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Total jumlah pembayaran harus lebih dari 0' },
        { status: 400 }
      )
    }

    // Pre-flight: find the user's wallet
    const wallet = await db.wallet.findUnique({
      where: { userId: authResult.user.id },
    })

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet tidak ditemukan' },
        { status: 404 }
      )
    }

    // Pre-flight balance check (nicer error before entering transaction)
    if (Number(wallet.balance) < totalDebitAmount) {
      return NextResponse.json(
        { success: false, error: `Saldo tidak mencukupi. Saldo: Rp ${Number(wallet.balance).toLocaleString('id-ID')}, Dibutuhkan: Rp ${totalDebitAmount.toLocaleString('id-ID')}` },
        { status: 400 }
      )
    }

    // Pre-flight: fetch and validate all orders
    const orderIds = orders.map(o => o.orderId)
    const fetchedOrders = await db.order.findMany({
      where: { id: { in: orderIds } },
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

    // Validate that all orders exist
    if (fetchedOrders.length !== orderIds.length) {
      const foundIds = new Set(fetchedOrders.map(o => o.id))
      const missingIds = orderIds.filter(id => !foundIds.has(id))
      return NextResponse.json(
        { success: false, error: `Pesanan tidak ditemukan: ${missingIds.join(', ')}` },
        { status: 404 }
      )
    }

    // Validate all orders belong to the authenticated user
    const foreignOrder = fetchedOrders.find(o => o.userId !== authResult.user.id)
    if (foreignOrder) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Anda hanya bisa membayar pesanan sendiri' },
        { status: 403 }
      )
    }

    // Validate all orders are in a payable state
    const unpaidOrder = fetchedOrders.find(o => o.status !== 'pending')
    if (unpaidOrder) {
      return NextResponse.json(
        { success: false, error: `Pesanan ${unpaidOrder.orderNumber} tidak bisa dibayar. Status: ${unpaidOrder.status}` },
        { status: 400 }
      )
    }

    const invalidPaymentStatus = fetchedOrders.find(o => o.paymentStatus !== 'unpaid' && o.paymentStatus !== 'pending')
    if (invalidPaymentStatus) {
      return NextResponse.json(
        { success: false, error: `Status pembayaran pesanan ${invalidPaymentStatus.orderNumber} sudah: ${invalidPaymentStatus.paymentStatus}` },
        { status: 400 }
      )
    }

    // Validate amounts match order totals
    const orderMap = new Map(fetchedOrders.map(o => [o.id, o]))
    for (const debit of orders) {
      const order = orderMap.get(debit.orderId)!
      if (Math.abs(Number(order.totalAmount) - debit.amount) > 1) {
        return NextResponse.json(
          { success: false, error: `Jumlah pembayaran untuk pesanan ${order.orderNumber} tidak sesuai. Total: Rp ${Number(order.totalAmount).toLocaleString('id-ID')}` },
          { status: 400 }
        )
      }
    }

    // IDEMPOTENCY: Check if any order was already debited
    const existingDebits = await db.walletMutation.findMany({
      where: {
        walletId: wallet.id,
        type: 'debit',
        refType: 'order',
        refId: { in: orderIds },
      },
    })

    if (existingDebits.length > 0) {
      const alreadyPaidOrderNumbers = existingDebits.map(d => {
        const order = fetchedOrders.find(o => o.id === d.refId)
        return order?.orderNumber || d.refId
      })
      return NextResponse.json(
        { success: false, error: `Pembayaran untuk pesanan berikut sudah diproses sebelumnya: ${alreadyPaidOrderNumbers.join(', ')}` },
        { status: 400 }
      )
    }

    // ==================== ATOMIC TRANSACTION ====================
    // All debits happen in a single transaction — either all succeed or all fail
    const result = await db.$transaction(async (tx) => {
      // SECURITY: Re-fetch wallet inside transaction to prevent race conditions (double-spend)
      const currentWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      })

      if (!currentWallet || Number(currentWallet.balance) < totalDebitAmount) {
        throw new Error(`Saldo tidak mencukupi. Saldo: Rp ${Number(currentWallet?.balance ?? 0).toLocaleString('id-ID')}, Dibutuhkan: Rp ${totalDebitAmount.toLocaleString('id-ID')}`)
      }

      // 1. Deduct wallet balance (single decrement for total)
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: totalDebitAmount } },
      })

      // 2. Process each order
      const paidOrders: { orderId: string; orderNumber: string; amount: number }[] = []

      for (const debit of orders) {
        const order = orderMap.get(debit.orderId)!

        // Create wallet mutation (debit) for this order
        await tx.walletMutation.create({
          data: {
            walletId: wallet.id,
            type: 'debit',
            amount: debit.amount,
            balance: updatedWallet.balance,
            description: description || `Pembayaran pesanan ${order.orderNumber}`,
            refType: 'order',
            refId: debit.orderId,
          },
        })

        // Update order status to paid
        await tx.order.update({
          where: { id: debit.orderId },
          data: {
            status: 'paid',
            paymentStatus: 'paid',
            paymentMethod: 'MartUp Pay',
            paidAt: new Date(),
          },
        })

        // Create transaction record
        await tx.transaction.create({
          data: {
            userId: authResult.user.id,
            type: 'payment',
            amount: debit.amount,
            fee: Number(order.platformFee),
            netAmount: debit.amount - Number(order.platformFee),
            method: 'wallet',
            status: 'success',
            description: `Pembayaran pesanan ${order.orderNumber} via MartUp Pay`,
            refId: order.orderNumber,
          },
        })

        // Process seller payout
        const subtotal = Number(order.subtotal)
        const commissionRate = await getEffectiveCommissionRate(Number(order.seller.commissionRate))
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
            balance: updatedSellerWallet.balance,
            description: `Pendapatan dari pesanan ${order.orderNumber} - ${order.seller.storeName}`,
            refType: 'order',
            refId: debit.orderId,
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

        // Create notification for buyer
        await tx.notification.create({
          data: {
            userId: order.userId,
            title: 'Pembayaran Berhasil',
            content: `Pembayaran untuk pesanan ${order.orderNumber} sebesar Rp ${Number(order.totalAmount).toLocaleString('id-ID')} via MartUp Pay telah berhasil.`,
            type: 'order',
            refType: 'order',
            refId: debit.orderId,
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
            refId: debit.orderId,
          },
        })

        paidOrders.push({
          orderId: debit.orderId,
          orderNumber: order.orderNumber,
          amount: debit.amount,
        })
      }

      return { walletBalance: Number(updatedWallet.balance), paidOrders }
    })

    logBusinessEvent({
      event: 'WALLET_BATCH_PAYMENT',
      userId: authResult.user.id,
      details: { orderCount: orders.length, totalAmount: totalDebitAmount, orderIds },
    })

    logger.info({ userId: authResult.user.id, orderCount: orders.length, totalAmount: totalDebitAmount }, 'Wallet batch payment successful')

    // Invalidate user-data cache so the buyer sees updated balance immediately
    invalidateUserDataCache(authResult.user.id)
    // Also invalidate cached data for all sellers whose pending balances changed
    const sellerUserIds = new Set(fetchedOrders.map(o => o.seller.userId))
    for (const sellerUserId of sellerUserIds) {
      invalidateUserDataCache(sellerUserId)
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        paidOrders: result.paidOrders,
        totalAmount: totalDebitAmount,
        newBalance: result.walletBalance,
        paymentMethod: 'MartUp Pay',
      },
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'POST /api/wallet/debit-batch error')

    // Check if this is a known business logic error (thrown from inside the transaction)
    if (error instanceof Error && error.message.startsWith('Saldo tidak mencukupi')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
