import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'

import { logger } from '@/lib/logger'
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    // Run all independent count queries in parallel
    const [
      totalUsers,
      totalSellers,
      totalOrders,
      revenueResult,
      pendingWithdrawals,
      activeProducts,
      openComplaints,
      unverifiedSellers,
      pendingWithdrawalAmount,
      totalDivisions,
      totalStaff,
      paymentMethodRaw,
    ] = await Promise.all([
      db.user.count(),
      db.seller.count(),
      db.order.count(),
      db.order.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: 'paid' },
      }),
      db.withdrawal.count({ where: { status: 'pending' } }),
      db.product.count({ where: { status: 'active' } }),
      db.complaint.count({ where: { status: 'open' } }),
      db.seller.count({ where: { isVerified: false } }),
      db.withdrawal.aggregate({
        _sum: { amount: true },
        where: { status: 'pending' },
      }),
      db.division.count(),
      db.user.count({
        where: {
          role: {
            in: ['admin', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr'],
          },
        },
      }),
      db.$queryRaw<
        Array<{ paymentMethod: string; count: bigint }>
      >`
        SELECT "paymentMethod", COUNT(*) AS count
        FROM "Order"
        WHERE "paymentStatus" = 'paid'
          AND "paymentMethod" IS NOT NULL
        GROUP BY "paymentMethod"
        ORDER BY count DESC
      `,
    ])

    const totalRevenue = revenueResult._sum.totalAmount ?? 0
    const totalPendingWithdrawal = pendingWithdrawalAmount._sum.amount ?? 0

    const paymentMethodDistribution = paymentMethodRaw.map((row) => ({
      paymentMethod: row.paymentMethod,
      count: Number(row.count),
    }))

    // Revenue chart for last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const revenueChartRaw: Array<{ month: Date; revenue: bigint }> =
      await db.$queryRaw`
        SELECT
          DATE_TRUNC('month', "createdAt") AS month,
          COALESCE(SUM("totalAmount"), 0) AS revenue
        FROM "Order"
        WHERE "paymentStatus" = 'paid'
          AND "createdAt" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month ASC
      `

    // User growth for last 6 months
    const userGrowthRaw: Array<{ month: Date; users: bigint }> =
      await db.$queryRaw`
        SELECT
          DATE_TRUNC('month', "createdAt") AS month,
          COUNT(*) AS users
        FROM "User"
        WHERE "createdAt" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month ASC
      `

    // Build month labels for last 6 months to fill gaps
    const revenueChartMap = new Map<string, number>()
    for (const row of revenueChartRaw) {
      const key = row.month.toISOString().slice(0, 7) // YYYY-MM
      revenueChartMap.set(key, Number(row.revenue))
    }

    const userGrowthMap = new Map<string, number>()
    for (const row of userGrowthRaw) {
      const key = row.month.toISOString().slice(0, 7) // YYYY-MM
      userGrowthMap.set(key, Number(row.users))
    }

    const revenueChart: Array<{ date: string; revenue: number }> = []
    const userGrowth: Array<{ date: string; users: number }> = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      revenueChart.push({
        date: key,
        revenue: revenueChartMap.get(key) ?? 0,
      })

      userGrowth.push({
        date: key,
        users: userGrowthMap.get(key) ?? 0,
      })
    }

    // Top Sellers by revenue
    const topSellersRaw: { name: string; revenue: number; orders: bigint }[] = await db.$queryRaw`
      SELECT s."storeName" AS name, COALESCE(SUM(o."totalAmount"), 0) AS revenue, COUNT(o.id) AS orders
      FROM "Seller" s
      JOIN "Order" o ON o."sellerId" = s.id
      WHERE o."paymentStatus" = 'paid'
      GROUP BY s.id, s."storeName"
      ORDER BY revenue DESC
      LIMIT 5
    `

    const topSellers = topSellersRaw.map((s) => ({
      name: s.name,
      revenue: Number(s.revenue),
      orders: Number(s.orders),
    }))

    // Category Performance
    const categoryPerformanceRaw: { name: string; revenue: number }[] = await db.$queryRaw`
      SELECT c.name, COALESCE(SUM(oi.subtotal), 0) AS revenue
      FROM "Category" c
      JOIN "Product" p ON p."categoryId" = c.id
      JOIN "OrderItem" oi ON oi."productId" = p.id
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."paymentStatus" = 'paid'
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `

    const totalCategoryRevenue = categoryPerformanceRaw.reduce(
      (sum, c) => sum + Number(c.revenue),
      0
    )

    const categoryPerformance = categoryPerformanceRaw.map((c) => ({
      name: c.name,
      revenue: Number(c.revenue),
      percentage: totalCategoryRevenue > 0 ? Math.round((Number(c.revenue) / totalCategoryRevenue) * 100) : 0,
    }))

    // Recent Activity
    const [recentOrders, recentUsers] = await Promise.all([
      db.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
      }),
      db.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
    ])

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        totalUsers,
        totalSellers,
        totalOrders,
        totalRevenue,
        pendingWithdrawals,
        activeProducts,
        openComplaints,
        unverifiedSellers,
        pendingWithdrawalAmount: totalPendingWithdrawal,
        totalDivisions,
        totalStaff,
        paymentMethodDistribution,
        revenueChart,
        userGrowth,
        topSellers,
        categoryPerformance,
        recentOrders: recentOrders.map((o) => ({
          ...o,
          totalAmount: Number(o.totalAmount),
          createdAt: o.createdAt.toISOString(),
        })),
        recentUsers: recentUsers.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        })),
      },
    }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin stats GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
