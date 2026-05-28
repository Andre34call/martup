import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// ==================== POST /api/admin/recalculate-stats ====================
// Recalculates ALL product and seller stats from actual database data.
// This fixes any stale or fake/inflated stats that may have been seeded.
// SECURITY: Requires admin authentication

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication
    const authResult = await verifyAdmin(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const results = {
      productSalesRecalculated: 0,
      productReviewsRecalculated: 0,
      sellerProductsRecalculated: 0,
      sellerOrdersRecalculated: 0,
      sellerRatingsRecalculated: 0,
    }

    // 1. Recalculate product `sold` from actual OrderItems
    const productSales = await db.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: { order: { status: { notIn: ['cancelled'] } } },
    })
    for (const ps of productSales) {
      if (ps.productId && ps._sum.quantity) {
        await db.product.update({
          where: { id: ps.productId },
          data: { sold: ps._sum.quantity },
        })
        results.productSalesRecalculated++
      }
    }

    // Reset sold to 0 for products that have no order items but sold > 0
    const productsWithNoSales = await db.product.findMany({
      where: { sold: { not: 0 }, id: { notIn: productSales.map(ps => ps.productId!).filter(Boolean) } },
      select: { id: true },
    })
    if (productsWithNoSales.length > 0) {
      await db.product.updateMany({
        where: { id: { in: productsWithNoSales.map(p => p.id) } },
        data: { sold: 0 },
      })
    }

    // 2. Recalculate product `rating` and `reviewCount` from actual Reviews
    const productReviews = await db.review.groupBy({
      by: ['productId'],
      _avg: { rating: true },
      _count: { id: true },
    })
    for (const pr of productReviews) {
      if (pr.productId) {
        await db.product.update({
          where: { id: pr.productId },
          data: {
            rating: pr._avg.rating ? Math.round(pr._avg.rating * 10) / 10 : 0,
            reviewCount: pr._count.id,
          },
        })
        results.productReviewsRecalculated++
      }
    }

    // Reset rating/reviewCount to 0 for products with no reviews
    const productsWithReviews = new Set(productReviews.map(pr => pr.productId).filter(Boolean) as string[])
    await db.product.updateMany({
      where: { reviewCount: { not: 0 }, id: { notIn: [...productsWithReviews] } },
      data: { rating: 0, reviewCount: 0 },
    })

    // 3. Recalculate seller `totalProducts` from actual active products
    const sellerProductCounts = await db.product.groupBy({
      by: ['sellerId'],
      _count: { id: true },
      where: { status: 'active' },
    })
    const sellersWithProducts = new Set<string>()
    for (const sp of sellerProductCounts) {
      if (sp.sellerId) {
        await db.seller.update({
          where: { id: sp.sellerId },
          data: { totalProducts: sp._count.id },
        })
        sellersWithProducts.add(sp.sellerId)
        results.sellerProductsRecalculated++
      }
    }

    // Reset totalProducts to 0 for sellers with no active products
    const allSellers = await db.seller.findMany({ select: { id: true } })
    for (const s of allSellers) {
      if (!sellersWithProducts.has(s.id)) {
        await db.seller.update({
          where: { id: s.id },
          data: { totalProducts: 0 },
        })
      }
    }

    // 4. Recalculate seller `totalSales` from actual non-cancelled orders
    const sellerOrderCounts = await db.order.groupBy({
      by: ['sellerId'],
      _count: { id: true },
      where: { status: { notIn: ['cancelled'] } },
    })
    const sellersWithOrders = new Set<string>()
    for (const so of sellerOrderCounts) {
      if (so.sellerId) {
        await db.seller.update({
          where: { id: so.sellerId },
          data: { totalSales: so._count.id },
        })
        sellersWithOrders.add(so.sellerId)
        results.sellerOrdersRecalculated++
      }
    }

    // Reset totalSales to 0 for sellers with no orders
    for (const s of allSellers) {
      if (!sellersWithOrders.has(s.id)) {
        await db.seller.update({
          where: { id: s.id },
          data: { totalSales: 0 },
        })
      }
    }

    // 5. Recalculate seller `rating` from average of their products' ratings
    const sellersWithRatings = await db.seller.findMany({
      include: {
        products: {
          where: { rating: { gt: 0 } },
          select: { rating: true },
        },
      },
    })
    for (const seller of sellersWithRatings) {
      if (seller.products.length > 0) {
        const avgRating = seller.products.reduce((sum, p) => sum + p.rating, 0) / seller.products.length
        await db.seller.update({
          where: { id: seller.id },
          data: { rating: Math.round(avgRating * 10) / 10 },
        })
      } else {
        await db.seller.update({
          where: { id: seller.id },
          data: { rating: 0 },
        })
      }
      results.sellerRatingsRecalculated++
    }

    logger.info({ results, adminId: authResult.user.id }, 'Stats recalculated by admin')

    return NextResponse.json({
      success: true,
      message: 'Semua statistik telah dihitung ulang dari data asli database',
      results,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Recalculate stats error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
