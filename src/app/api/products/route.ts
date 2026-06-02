import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

// Helper to safely parse JSON fields
function parseJsonField(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// GET /api/products - Fetch active products with various sort options
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    const isFlashSale = searchParams.get('isFlashSale')
    const sellerId = searchParams.get('sellerId')
    const isPromoted = searchParams.get('isPromoted')
    const isFeatured = searchParams.get('isFeatured')
    const sort = searchParams.get('sort') || 'viral' // default to viral
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)

    // Build where clause
    const where: Record<string, unknown> = {
      status: 'active',
    }

    if (categoryId) where.categoryId = categoryId
    if (sellerId) where.sellerId = sellerId
    if (isFlashSale === 'true') where.isFlashSale = true
    if (isPromoted === 'true') {
      where.isPromoted = true
      where.promotedUntil = { gt: new Date() }
    }
    if (isFeatured === 'true') where.isFeatured = true

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ]
    }

    let orderBy: Record<string, unknown> | Record<string, unknown>[] = { createdAt: 'desc' }

    if (sort === 'popular') {
      orderBy = [{ sold: 'desc' }, { rating: 'desc' }]
    } else if (sort === 'newest') {
      orderBy = { createdAt: 'desc' }
    } else if (sort === 'promoted') {
      // For promoted sort, override where to show promoted only
      where.isPromoted = true
      where.promotedUntil = { gt: new Date() }
      orderBy = { promotedUntil: 'asc' }
    }

    // For viral sort, use Prisma (safe from SQL injection) + in-memory viral score sort
    if (sort === 'viral') {
      // SECURITY: Use Prisma's built-in query builder instead of raw SQL
      // to eliminate any SQL injection risk. All user inputs are properly
      // parameterized by Prisma's query engine.
      const [allProducts, total] = await Promise.all([
        db.product.findMany({
          where,
          select: {
            id: true,
            sold: true,
            rating: true,
            reviewCount: true,
            viewCount: true,
            viralScore: true,
            createdAt: true,
          },
        }),
        db.product.count({ where }),
      ])

      // Sort by viral score in-memory (computed field not sortable via Prisma)
      // Formula: sold * 3 + rating * reviewCount * 5 + viewCount * 0.1
      const scored = allProducts.map(p => ({
        id: p.id,
        viralScore: p.sold * 3 + (p.rating || 0) * p.reviewCount * 5 + p.viewCount * 0.1,
      }))
      scored.sort((a, b) => b.viralScore - a.viralScore || Number(b.createdAt) - Number(a.createdAt))

      // Apply pagination
      const paginated = scored.slice(offset, offset + limit)
      const productIds = paginated.map(p => p.id)

      if (productIds.length === 0) {
        return NextResponse.json(serializeDecimal({
          success: true,
          data: [],
          pagination: { total, limit, offset, hasMore: false },
        }))
      }

      // Fetch full products with relations using the paginated IDs
      const products = await db.product.findMany({
        where: { id: { in: productIds } },
        include: {
          seller: {
            select: {
              id: true, storeName: true, storeSlug: true, storeAvatar: true,
              storeDesc: true, isVerified: true, isPremium: true,
              rating: true, totalSales: true, totalProducts: true, responseTime: true,
            },
          },
          category: { select: { id: true, name: true, slug: true, icon: true } },
          variants: true,
        },
      })

      // Re-sort to match viral order
      const viralScoreMap = new Map(paginated.map(p => [p.id, p.viralScore]))
      products.sort((a, b) => {
        const scoreA = viralScoreMap.get(a.id) || 0
        const scoreB = viralScoreMap.get(b.id) || 0
        return scoreB - scoreA
      })

      // Attach viral scores and parse JSON fields
      const parsedProducts = products.map((product) => ({
        ...product,
        viralScore: viralScoreMap.get(product.id) || 0,
        images: parseJsonField(product.images),
        tags: parseJsonField(product.tags),
      }))

      return NextResponse.json(serializeDecimal({
        success: true,
        data: parsedProducts,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      }))
    }

    // Non-viral sort: use Prisma directly
    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          seller: {
            select: {
              id: true, storeName: true, storeSlug: true, storeAvatar: true,
              storeDesc: true, isVerified: true, isPremium: true,
              rating: true, totalSales: true, totalProducts: true, responseTime: true,
            },
          },
          category: { select: { id: true, name: true, slug: true, icon: true } },
          variants: true,
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      db.product.count({ where }),
    ])

    const parsedProducts = products.map((product) => ({
      ...product,
      images: parseJsonField(product.images),
      tags: parseJsonField(product.tags),
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedProducts,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Products GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
