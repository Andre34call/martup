import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/admin/stats - Fetch admin dashboard statistics
export async function GET() {
  try {
    // Run all simple count/sum queries in parallel
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

    // Revenue chart for last 6 months using raw query with date_trunc
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

    return NextResponse.json({
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
        paymentMethodDistribution,
        revenueChart,
        userGrowth,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin stats GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
