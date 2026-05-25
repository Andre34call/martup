import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/seller/stats?sellerId=xxx - Fetch seller dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')

    if (!sellerId) {
      return NextResponse.json(
        { success: false, error: 'sellerId is required' },
        { status: 400 }
      )
    }

    // Verify seller exists
    const seller = await db.seller.findUnique({
      where: { id: sellerId },
      select: { id: true, commissionRate: true },
    })

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Seller not found' },
        { status: 404 }
      )
    }

    // Commission rate (default 5%)
    const commissionRate = seller.commissionRate ?? 0.05
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
    const totalRevenue = (revenueAgg._sum.subtotal ?? 0) * sellerKeepRate

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
      revenue: p.sold * p.price * sellerKeepRate,
    }))

    // Last 5 orders for this seller
    const recentOrders = await db.order.findMany({
      where: { sellerId },
      include: {
        items: {
          select: {
            id: true,
            productName: true,
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
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

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
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Seller stats GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
