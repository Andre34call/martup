import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSeller } from '@/lib/auth-helpers'

import { logger } from '@/lib/logger'
export async function GET() {
  try {
    const { seller } = await requireSeller()

    // Get full seller profile with additional stats
    const fullSeller = await db.seller.findUnique({
      where: { id: seller.id },
      include: {
        wallet: {
          select: {
            id: true,
            balance: true,
            holdBalance: true,
          },
        },
        _count: {
          select: {
            products: { where: { status: 'active' } },
            orders: true,
          },
        },
      },
    })

    if (!fullSeller) {
      return NextResponse.json(
        { error: 'Seller not found' },
        { status: 404 }
      )
    }

    // Calculate additional stats
    const totalRevenue = await db.order.aggregate({
      where: {
        sellerId: seller.id,
        status: { in: ['delivered', 'paid', 'shipped'] },
      },
      _sum: { totalAmount: true },
    })

    const pendingOrders = await db.order.count({
      where: {
        sellerId: seller.id,
        status: 'pending',
      },
    })

    const profile = {
      id: fullSeller.id,
      userId: fullSeller.userId,
      storeName: fullSeller.storeName,
      storeSlug: fullSeller.storeSlug,
      storeDesc: fullSeller.storeDesc,
      storeAvatar: fullSeller.storeAvatar,
      storeBanner: fullSeller.storeBanner,
      storeAddress: fullSeller.storeAddress,
      isVerified: fullSeller.isVerified,
      isPremium: fullSeller.isPremium,
      rating: fullSeller.rating,
      totalSales: fullSeller.totalSales,
      totalProducts: fullSeller.totalProducts,
      responseTime: fullSeller.responseTime,
      bankAccount: fullSeller.bankAccount,
      bankName: fullSeller.bankName,
      bankHolder: fullSeller.bankHolder,
      commissionRate: fullSeller.commissionRate,
      createdAt: fullSeller.createdAt,
      wallet: fullSeller.wallet,
      stats: {
        activeProducts: fullSeller._count.products,
        totalOrders: fullSeller._count.orders,
        totalRevenue: totalRevenue._sum.totalAmount ?? 0,
        pendingOrders,
      },
    }

    return NextResponse.json(profile)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message === 'Seller account required') {
      return NextResponse.json({ error: 'Seller account required' }, { status: 403 })
    }
    logger.error({ err: error }, 'GET /api/seller/profile error')
    return NextResponse.json(
      { error: 'Failed to fetch seller profile' },
      { status: 500 }
    )
  }
}
