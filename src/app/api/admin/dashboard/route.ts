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

    // Revenue chart - last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyOrders = await db.order.findMany({
      where: {
        status: { in: ['paid', 'processing', 'shipped', 'delivered'] },
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    })

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const revenueMap = new Map<string, number>()
    for (const order of monthlyOrders) {
      const key = monthNames[order.createdAt.getMonth()]
      revenueMap.set(key, (revenueMap.get(key) || 0) + Number(order.totalAmount))
    }
    const revenueChart = Array.from(revenueMap.entries()).map(([date, revenue]) => ({ date, revenue }))

    // User growth - last 6 months
    const recentUsers = await db.user.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    })

    const userMap = new Map<string, number>()
    for (const user of recentUsers) {
      const key = monthNames[user.createdAt.getMonth()]
      userMap.set(key, (userMap.get(key) || 0) + 1)
    }
    const userGrowth = Array.from(userMap.entries()).map(([date, users]) => ({ date, users }))

    return NextResponse.json({
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
    })
  } catch (error) {
    logger.error({ err: error }, 'Get admin dashboard error')
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
