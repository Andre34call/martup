import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'

import { parseJsonField } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Verify the authenticated user is a seller
    const authenticatedSeller = await db.seller.findFirst({
      where: { userId: authResult.user.id },
      select: { id: true },
    })

    if (!authenticatedSeller) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Seller account required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const requestedSellerId = searchParams.get('sellerId')

    // SECURITY: Determine which seller's dashboard to return
    let sellerId: string
    if (requestedSellerId) {
      // If sellerId param provided, verify ownership or admin role
      if (authenticatedSeller.id !== requestedSellerId && authResult.user.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden - You can only view your own dashboard' },
          { status: 403 }
        )
      }
      sellerId = requestedSellerId
    } else {
      // No sellerId param, use the authenticated seller's ID
      sellerId = authenticatedSeller.id
    }

    const seller = await db.seller.findUnique({
      where: { id: sellerId },
    })

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Seller tidak ditemukan' },
        { status: 404 }
      )
    }

    // Get total revenue from completed orders
    const revenueResult = await db.order.aggregate({
      where: {
        sellerId,
        status: { in: ['paid', 'processing', 'shipped', 'delivered'] },
      },
      _sum: { subtotal: true },
      _count: true,
    })

    const totalRevenue = revenueResult._sum.subtotal || 0
    const totalOrders = revenueResult._count

    // Get pending orders
    const pendingOrders = await db.order.count({
      where: { sellerId, status: 'pending' },
    })

    // Get total active products
    const totalProducts = await db.product.count({
      where: { sellerId, status: 'active' },
    })

    // Get monthly revenue (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyOrders = await db.order.findMany({
      where: {
        sellerId,
        status: { in: ['paid', 'processing', 'shipped', 'delivered'] },
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    })

    // Group by month
    const monthlyRevenueMap = new Map<string, number>()
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    for (const order of monthlyOrders) {
      const monthKey = `${monthNames[order.createdAt.getMonth()]}`
      monthlyRevenueMap.set(
        monthKey,
        (monthlyRevenueMap.get(monthKey) || 0) + Number(order.totalAmount)
      )
    }

    const monthlyRevenue = Array.from(monthlyRevenueMap.entries()).map(
      ([month, revenue]) => ({ month, revenue })
    )

    // Get top products
    const topProducts = await db.product.findMany({
      where: { sellerId, status: 'active' },
      orderBy: { sold: 'desc' },
      take: 5,
      select: {
        name: true,
        sold: true,
        price: true,
      },
    })

    const topProductStats = topProducts.map((p) => ({
      name: p.name,
      sold: p.sold,
      revenue: p.sold * Number(p.price),
    }))

    // Get recent orders
    const recentOrders = await db.order.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        items: {
          take: 1,
          include: {
            product: {
              select: { name: true, images: true },
            },
          },
        },
      },
    })

    const parsedRecentOrders = recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        ...i,
        product: {
          ...i.product,
          images: parseJsonField(i.product.images),
        },
      })),
    }))

    return NextResponse.json({
      success: true,
      stats: {
        totalRevenue,
        totalOrders,
        totalProducts,
        pendingOrders,
        monthlyRevenue,
        topProducts: topProductStats,
        recentOrders: parsedRecentOrders,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Get seller dashboard error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
