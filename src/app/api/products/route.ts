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

    // For viral sort, use raw SQL to compute viral score
    if (sort === 'viral') {
      // Build WHERE clause for raw SQL
      const conditions: string[] = ['p.status = \'active\'']
      const params: unknown[] = []
      let paramIdx = 1

      if (categoryId) {
        conditions.push(`p.category_id = $${paramIdx++}`)
        params.push(categoryId)
      }
      if (sellerId) {
        conditions.push(`p.seller_id = $${paramIdx++}`)
        params.push(sellerId)
      }
      if (isFlashSale === 'true') {
        conditions.push('p.is_flash_sale = true')
      }
      if (isPromoted === 'true') {
        conditions.push('p.is_promoted = true')
        conditions.push('p.promoted_until > NOW()')
      }
      if (isFeatured === 'true') {
        conditions.push('p.is_featured = true')
      }
      if (search) {
        conditions.push(`(p.name ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx} OR p.tags ILIKE $${paramIdx})`)
        params.push(`%${search}%`)
        paramIdx++
      }

      const whereClause = conditions.join(' AND ')

      // Get total count
      const countResult = await db.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM products p WHERE ${whereClause}`,
        ...params
      )
      const total = Number((countResult as Array<Record<string, unknown>>)[0]?.count || 0)

      // Get product IDs sorted by viral score
      const limitParam = paramIdx++
      const offsetParam = paramIdx++
      const viralProducts = await db.$queryRawUnsafe(
        `SELECT p.id, 
          (p.sold * 3 + COALESCE(p.rating, 0) * p.review_count * 5 + p.view_count * 0.1) as viral_score
         FROM products p 
         WHERE ${whereClause}
         ORDER BY viral_score DESC NULLS LAST, p.created_at DESC
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        ...params, limit, offset
      ) as Array<{ id: string; viral_score: number }>

      // Fetch full products with relations using the IDs
      const productIds = viralProducts.map(p => p.id)

      if (productIds.length === 0) {
        return NextResponse.json(serializeDecimal({
          success: true,
          data: [],
          pagination: { total, limit, offset, hasMore: false },
        }))
      }

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

      // Re-sort to match viral order from raw SQL
      const viralScoreMap = new Map(viralProducts.map(p => [p.id, Number(p.viral_score)]))
      products.sort((a, b) => {
        const scoreA = viralScoreMap.get(a.id) || 0
        const scoreB = viralScoreMap.get(b.id) || 0
        return scoreB - scoreA
      })

      // Update viralScore on the products and parse JSON fields
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
