import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Run all independent count queries in parallel
    const [
      totalUsers,
      totalSellers,
      totalOrders,
      totalRevenueResult,
      activeProducts,
      pendingWithdrawals,
      totalDivisions,
      totalStaff,
      pendingSellerVerifications,
      openComplaints,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: 'seller' } }),
      db.order.count(),
      db.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: { in: ['paid', 'delivered'] } },
      }),
      db.product.count({ where: { status: 'active' } }),
      db.withdrawal.count({ where: { status: 'pending' } }),
      db.division.count(),
      db.user.count({
        where: {
          role: {
            in: ['admin', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr'],
          },
        },
      }),
      db.seller.count({ where: { isVerified: false } }),
      db.complaint.count({ where: { status: 'open' } }),
    ])

    const totalRevenue = totalRevenueResult._sum.totalAmount ?? 0

    // ============ Revenue Chart - last 6 months ============
    const revenueChartRaw: { date: string; revenue: number }[] = await db.$queryRaw`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') AS date, COALESCE(SUM("totalAmount"), 0) AS revenue
      FROM "Order"
      WHERE status IN ('paid', 'delivered', 'shipped')
        AND "createdAt" >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY date ASC
    `

    // Fill in missing months with zero
    const revenueChart = fillMissingMonths(revenueChartRaw, 'revenue')

    // ============ User Growth Chart - cumulative by month ============
    const userGrowthRaw: { date: string; users: bigint }[] = await db.$queryRaw`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') AS date, COUNT(*) AS users
      FROM "User"
      WHERE "createdAt" >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY date ASC
    `

    // Get total users before the 6-month window for cumulative calculation
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const usersBeforeWindow = await db.user.count({
      where: { createdAt: { lt: sixMonthsAgo } },
    })

    // Build cumulative user growth
    const userGrowth = buildCumulativeUserGrowth(userGrowthRaw, usersBeforeWindow)

    // ============ Top Sellers by revenue ============
    const topSellersRaw: { name: string; revenue: number; orders: bigint }[] = await db.$queryRaw`
      SELECT s."storeName" AS name, COALESCE(SUM(o."totalAmount"), 0) AS revenue, COUNT(o.id) AS orders
      FROM "Seller" s
      JOIN "Order" o ON o."sellerId" = s.id
      WHERE o.status IN ('paid', 'delivered', 'shipped')
      GROUP BY s.id, s."storeName"
      ORDER BY revenue DESC
      LIMIT 5
    `

    const topSellers = topSellersRaw.map((s) => ({
      name: s.name,
      revenue: Number(s.revenue),
      orders: Number(s.orders),
    }))

    // ============ Category Performance ============
    const categoryPerformanceRaw: { name: string; revenue: number }[] = await db.$queryRaw`
      SELECT c.name, COALESCE(SUM(oi.subtotal), 0) AS revenue
      FROM "Category" c
      JOIN "Product" p ON p."categoryId" = c.id
      JOIN "OrderItem" oi ON oi."productId" = p.id
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o.status IN ('paid', 'delivered', 'shipped')
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

    // ============ Recent Activity ============
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

    return NextResponse.json({
      success: true,
      stats: {
        // Summary metrics
        totalUsers,
        totalSellers,
        totalOrders,
        totalRevenue,
        activeProducts,
        pendingWithdrawals,
        totalDivisions,
        totalStaff,
        pendingSellerVerifications,
        openComplaints,
        // Chart data
        revenueChart,
        userGrowth,
        // Performance data
        topSellers,
        categoryPerformance,
        // Recent activity
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
    })
  } catch (error) {
    console.error('[Admin Stats API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch admin stats' },
      { status: 500 }
    )
  }
}

// ============ Helper: Fill missing months in time-series ============
function getLast6Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    )
  }
  return months
}

function fillMissingMonths(
  data: { date: string; revenue: number }[],
  valueKey: string
): { date: string; revenue: number }[] {
  const months = getLast6Months()
  const dataMap = new Map(data.map((d) => [d.date, d[valueKey]]))
  return months.map((month) => ({
    date: month,
    revenue: Number(dataMap.get(month) ?? 0),
  }))
}

// ============ Helper: Build cumulative user growth ============
function buildCumulativeUserGrowth(
  raw: { date: string; users: bigint }[],
  usersBeforeWindow: number
): { date: string; users: number }[] {
  const months = getLast6Months()
  const monthlyMap = new Map(raw.map((r) => [r.date, Number(r.users)]))

  let cumulative = usersBeforeWindow
  return months.map((month) => {
    cumulative += monthlyMap.get(month) ?? 0
    return { date: month, users: cumulative }
  })
}
