import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

import { logger } from '@/lib/logger'

// GET /api/admin/dashboard - Dashboard stats
// SECURITY: Requires admin/manager authentication
export async function GET(request: NextRequest) {
  // Auth check — this was previously missing (critical security fix)
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const [
      totalUsers,
      totalSellers,
      totalOrders,
      orderRevenue,
      pendingWithdrawals,
      activeProducts,
    ] = await Promise.all([
      db.user.count(),
      db.seller.count(),
      db.order.count(),
      db.order.aggregate({
        where: { status: { in: ['paid', 'processing', 'shipped', 'delivered'] } },
        _sum: { totalAmount: true },
      }),
      db.withdrawal.count({ where: { status: 'pending' } }),
      db.product.count({ where: { status: 'active' } }),
    ])

    const totalRevenue = orderRevenue._sum.totalAmount || 0

    // Revenue chart - last 6 months (database-level GROUP BY instead of loading all orders)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyRevenue = await db.$queryRaw<Array<{ month: Date; total: bigint }>>`
      SELECT DATE_TRUNC('month', "createdAt") as month, SUM("totalAmount") as total
      FROM "Order"
      WHERE status IN ('paid', 'processing', 'shipped', 'delivered')
        AND "createdAt" >= ${sixMonthsAgo}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const revenueChart = monthlyRevenue.map(r => ({
      date: monthNames[r.month.getMonth()],
      revenue: Number(r.total),
    }))

    // User growth - last 6 months (database-level GROUP BY instead of loading all users)
    const monthlyUsers = await db.$queryRaw<Array<{ month: Date; total: bigint }>>`
      SELECT DATE_TRUNC('month', "createdAt") as month, COUNT(*) as total
      FROM "User"
      WHERE "createdAt" >= ${sixMonthsAgo}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `

    const userGrowth = monthlyUsers.map(r => ({
      date: monthNames[r.month.getMonth()],
      users: Number(r.total),
    }))

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalSellers,
          totalOrders,
          totalRevenue,
          pendingWithdrawals,
          activeProducts,
          revenueChart,
          userGrowth,
        },
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Get admin dashboard error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
