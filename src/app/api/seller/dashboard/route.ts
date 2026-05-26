import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

import { logger } from '@/lib/logger'
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')

    if (!sellerId) {
      return NextResponse.json(
        { error: 'SellerId wajib diisi' },
        { status: 400 }
      )
    }

    const seller = await db.seller.findUnique({
      where: { id: sellerId },
    })

    if (!seller) {
      return NextResponse.json(
        { error: 'Seller tidak ditemukan' },
        { status: 404 }
      )
    }

    // Get total revenue from completed orders
    const revenueResult = await db.order.aggregate({
      where: {
        sellerId,
        status: { in: ['paid', 'processing', 'shipped', 'delivered'] },
      },
      _sum: { totalAmount: true },
      _count: true,
    })

    const totalRevenue = revenueResult._sum.totalAmount || 0
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
          images: i.product.images ? JSON.parse(i.product.images) : [],
        },
      })),
    }))

    return NextResponse.json({
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
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
