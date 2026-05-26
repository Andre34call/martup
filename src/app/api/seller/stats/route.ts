import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'

import { logger } from '@/lib/logger'
// GET /api/seller/stats?sellerId=xxx - Fetch seller dashboard statistics
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Verify the authenticated user is a seller
    const seller = await db.seller.findFirst({
      where: { userId: authResult.user.id },
      select: { id: true, commissionRate: true },
    })

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Seller account required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const requestedSellerId = searchParams.get('sellerId')

    // Determine which seller's stats to return
    let sellerId: string
    if (requestedSellerId) {
      // If sellerId param provided, verify ownership or admin role
      if (seller.id !== requestedSellerId && authResult.user.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden - You can only view your own stats' },
          { status: 403 }
        )
      }
      sellerId = requestedSellerId
    } else {
      // No sellerId param, use the authenticated seller's ID
      sellerId = seller.id
    }

    // Verify seller exists (for admin viewing another seller's stats)
    const targetSeller = requestedSellerId && requestedSellerId !== seller.id
      ? await db.seller.findUnique({
          where: { id: sellerId },
          select: { id: true, commissionRate: true },
        })
      : seller

    if (!targetSeller) {
      return NextResponse.json(
        { success: false, error: 'Seller not found' },
        { status: 404 }
      )
    }

    // Commission rate (default 5%) - convert Decimal to number for calculations
    const commissionRate = Number(targetSeller.commissionRate ?? 0.05)
    const sellerKeepRate = 1 - commissionRate

    // Run simple count queries in parallel
    const [totalOrders, totalProducts, pendingOrders] = await Promise.all([
      db.order.count({ where: { sellerId } }),
      db.product.count({ where: { sellerId } }),
      db.order.count({
        where: {
          sellerId,
          status: { in: ['pending', 'paid'] },
        },
      }),
    ])

    // Total revenue: sum of order subtotal * (1 - commissionRate) for paid/delivered orders
    const revenueAgg = await db.order.aggregate({
      _sum: { subtotal: true },
      where: {
        sellerId,
        status: { in: ['paid', 'delivered'] },
      },
    })
    const totalRevenue = Number(revenueAgg._sum.subtotal ?? 0) * sellerKeepRate

    // Monthly revenue for last 6 months using raw query
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const monthlyRevenueRaw: Array<{ month: Date; revenue: bigint }> =
      await db.$queryRaw`
        SELECT
          DATE_TRUNC('month', "createdAt") AS month,
          COALESCE(SUM("subtotal"), 0) AS revenue
        FROM "Order"
        WHERE "sellerId" = ${sellerId}
          AND "status" IN ('paid', 'delivered')
          AND "createdAt" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month ASC
      `

    // Build month labels with gap filling
    const monthlyRevenueMap = new Map<string, number>()
    for (const row of monthlyRevenueRaw) {
      const key = row.month.toISOString().slice(0, 7)
      monthlyRevenueMap.set(key, Number(row.revenue) * sellerKeepRate)
    }

    const monthlyRevenue: Array<{ month: string; revenue: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      monthlyRevenue.push({
        month: key,
        revenue: monthlyRevenueMap.get(key) ?? 0,
      })
    }

    // Top 4 products by sold count
    const topProductsRaw = await db.product.findMany({
      where: { sellerId },
      select: {
        name: true,
        sold: true,
        price: true,
      },
      orderBy: { sold: 'desc' },
      take: 4,
    })

    const topProducts = topProductsRaw.map((p) => ({
      name: p.name,
      sold: p.sold,
      revenue: p.sold * Number(p.price) * sellerKeepRate,
    }))

    // Last 5 orders for this seller
    const recentOrdersRaw = await db.order.findMany({
      where: { sellerId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            variantName: true,
            variantId: true,
            price: true,
            quantity: true,
            subtotal: true,
            image: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        shipping: {
          select: {
            id: true,
            provider: true,
            service: true,
            trackingNumber: true,
            estimatedDays: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // Map orders to include buyerName and proper shape for the frontend
    const recentOrders = recentOrdersRaw.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      userId: o.userId,
      sellerId: o.sellerId,
      status: o.status,
      subtotal: Number(o.subtotal),
      shippingCost: Number(o.shippingCost),
      discountAmount: Number(o.discountAmount),
      taxAmount: Number(o.taxAmount),
      platformFee: Number(o.platformFee),
      totalAmount: Number(o.totalAmount),
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      buyerName: o.user?.name || '',
      items: o.items,
      shipping: o.shipping,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      shippedAt: o.shippedAt,
      deliveredAt: o.deliveredAt,
    }))

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        totalProducts,
        totalVisitors: 0,
        pendingOrders,
        monthlyRevenue,
        topProducts,
        recentOrders,
        commissionRate,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Seller stats GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
