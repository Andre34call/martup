import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJsonField } from '@/lib/api-utils'
import { apiLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { serializeDecimal } from '@/lib/decimal-utils'
import { Prisma } from '@prisma/client'

/** Extract client IP from request headers (behind reverse proxy) */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

/** Valid sort options */
const SORT_OPTIONS = ['relevance', 'price_asc', 'price_desc', 'newest', 'popular', 'rating'] as const
type SortOption = (typeof SORT_OPTIONS)[number]

/** Valid condition values */
const VALID_CONDITIONS = ['new', 'used'] as const

// ==================== MAIN HANDLER ====================

// GET /api/search — Public advanced search endpoint (no auth required for browsing)
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // --- Rate limiting: 30 req/min per IP (distributed) ---
    const clientIp = getClientIp(request)
    const rateLimitResult = await apiLimiter.check(`search:${clientIp}`)
    if (!rateLimitResult.allowed) {
      logger.warn({ ip: clientIp }, 'Search rate limit exceeded')
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // --- Parse & validate query parameters ---
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q')?.trim() || ''
    if (q.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Search query must be at least 2 characters' },
        { status: 400 }
      )
    }
    if (q.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Search query must be at most 200 characters' },
        { status: 400 }
      )
    }

    const category = searchParams.get('category')?.trim() || undefined
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const condition = searchParams.get('condition')?.trim() || undefined
    const productType = searchParams.get('productType')?.trim() || undefined

    const sortByParam = searchParams.get('sortBy')?.trim() || 'relevance'
    const sortBy: SortOption = SORT_OPTIONS.includes(sortByParam as SortOption)
      ? (sortByParam as SortOption)
      : 'relevance'

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 50)

    // Validate condition filter
    if (condition && !VALID_CONDITIONS.includes(condition as (typeof VALID_CONDITIONS)[number])) {
      return NextResponse.json(
        { success: false, error: 'Invalid condition filter. Must be "new" or "used"' },
        { status: 400 }
      )
    }

    // Validate price filters
    let minPriceNum: number | undefined
    let maxPriceNum: number | undefined

    if (minPrice) {
      minPriceNum = parseFloat(minPrice)
      if (isNaN(minPriceNum) || minPriceNum < 0) {
        return NextResponse.json(
          { success: false, error: 'minPrice must be a valid non-negative number' },
          { status: 400 }
        )
      }
    }
    if (maxPrice) {
      maxPriceNum = parseFloat(maxPrice)
      if (isNaN(maxPriceNum) || maxPriceNum < 0) {
        return NextResponse.json(
          { success: false, error: 'maxPrice must be a valid non-negative number' },
          { status: 400 }
        )
      }
    }
    if (minPriceNum !== undefined && maxPriceNum !== undefined && minPriceNum > maxPriceNum) {
      return NextResponse.json(
        { success: false, error: 'minPrice cannot be greater than maxPrice' },
        { status: 400 }
      )
    }

    // --- Build where clause ---
    const baseWhere: Prisma.ProductWhereInput = {
      status: 'active',
    }

    // Category filter — needs to be combined with search OR
    const categoryFilter = category
      ? { category: { slug: category } }
      : {}

    // Condition filter
    if (condition) {
      baseWhere.condition = condition
    }

    // Product type filter (product = Barang, jasa = Tolong Mas)
    const VALID_PRODUCT_TYPES = ['product', 'jasa'] as const
    if (productType) {
      if (!VALID_PRODUCT_TYPES.includes(productType as (typeof VALID_PRODUCT_TYPES)[number])) {
        return NextResponse.json(
          { success: false, error: 'Invalid productType filter. Must be "product" or "jasa"' },
          { status: 400 }
        )
      }
      baseWhere.productType = productType
    }

    // Price range filter — apply on discountPrice if available, otherwise on price
    const priceConditions: Prisma.ProductWhereInput[] = []
    if (minPriceNum !== undefined || maxPriceNum !== undefined) {
      const discountFilter: Prisma.ProductWhereInput['discountPrice'] = {}
      const regularFilter: Prisma.ProductWhereInput['price'] = {}
      if (minPriceNum !== undefined) {
        ;(discountFilter as Record<string, unknown>).gte = new Prisma.Decimal(minPriceNum)
        ;(regularFilter as Record<string, unknown>).gte = new Prisma.Decimal(minPriceNum)
      }
      if (maxPriceNum !== undefined) {
        ;(discountFilter as Record<string, unknown>).lte = new Prisma.Decimal(maxPriceNum)
        ;(regularFilter as Record<string, unknown>).lte = new Prisma.Decimal(maxPriceNum)
      }
      priceConditions.push({
        OR: [
          { discountPrice: discountFilter },
          { discountPrice: null, price: regularFilter },
        ],
      })
    }

    // Combine: status=active + category + condition + productType + price + (search OR)
    const where: Prisma.ProductWhereInput = {
      ...baseWhere,
      ...categoryFilter,
      AND: priceConditions.length > 0 ? priceConditions : undefined,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { tags: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ],
    }

    // --- Fetch all matching product stubs for facets + relevance sort ---
    const allMatchingProducts = await db.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        discountPrice: true,
        condition: true,
        productType: true,
        createdAt: true,
        category: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    })

    const total = allMatchingProducts.length

    // --- Calculate facets from all matching products (before pagination) ---
    const categoryMap = new Map<string, { slug: string; name: string; count: number }>()
    let facetMinPrice = Infinity
    let facetMaxPrice = -Infinity
    const conditionMap = new Map<string, number>()
    const productTypeMap = new Map<string, number>()

    for (const p of allMatchingProducts) {
      // Category facet
      const cat = p.category
      if (cat) {
        const existing = categoryMap.get(cat.slug)
        if (existing) {
          existing.count++
        } else {
          categoryMap.set(cat.slug, { slug: cat.slug, name: cat.name, count: 1 })
        }
      }

      // Price range facet (use discountPrice if available, otherwise price)
      const effectivePrice = p.discountPrice ? Number(p.discountPrice) : Number(p.price)
      if (effectivePrice < facetMinPrice) facetMinPrice = effectivePrice
      if (effectivePrice > facetMaxPrice) facetMaxPrice = effectivePrice

      // Condition facet
      const condCount = conditionMap.get(p.condition) || 0
      conditionMap.set(p.condition, condCount + 1)

      // Product type facet (Barang/Tolong Mas)
      const ptCount = productTypeMap.get(p.productType) || 0
      productTypeMap.set(p.productType, ptCount + 1)
    }

    const facets = {
      categories: Array.from(categoryMap.values()).sort((a, b) => b.count - a.count),
      priceRange: {
        min: total > 0 ? facetMinPrice : 0,
        max: total > 0 ? facetMaxPrice : 0,
      },
      conditions: Array.from(conditionMap.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      productTypes: Array.from(productTypeMap.entries())
        .map(([value, count]) => ({ value, count, label: value === 'jasa' ? 'Tolong Mas' : 'Barang' }))
        .sort((a, b) => b.count - a.count),
    }

    // --- Determine ordering ---
    const skip = (page - 1) * limit
    let pagedIds: string[]

    if (sortBy === 'relevance') {
      // Relevance: products with name match first, then by createdAt desc
      const lowerQ = q.toLowerCase()
      const nameMatches: string[] = []
      const otherMatches: string[] = []

      for (const p of allMatchingProducts) {
        if (p.name.toLowerCase().includes(lowerQ)) {
          nameMatches.push(p.id)
        } else {
          otherMatches.push(p.id)
        }
      }
      // Name matches are already in createdAt desc order from the query
      pagedIds = [...nameMatches, ...otherMatches].slice(skip, skip + limit)
    } else {
      // For DB-level sort options, re-query with proper orderBy and pagination
      let orderBy: Prisma.ProductOrderByWithRelationInput
      switch (sortBy) {
        case 'price_asc':
          orderBy = { price: 'asc' }
          break
        case 'price_desc':
          orderBy = { price: 'desc' }
          break
        case 'newest':
          orderBy = { createdAt: 'desc' }
          break
        case 'popular':
          orderBy = { sold: 'desc' }
          break
        case 'rating':
          orderBy = { rating: 'desc' }
          break
        default:
          orderBy = { createdAt: 'desc' }
          break
      }

      const paginatedProducts = await db.product.findMany({
        where,
        select: { id: true },
        orderBy,
        skip,
        take: limit,
      })
      pagedIds = paginatedProducts.map((p) => p.id)
    }

    // --- Fetch full product data for the paginated IDs ---
    let products: unknown[] = []
    if (pagedIds.length > 0) {
      const fullProducts = await db.product.findMany({
        where: {
          id: { in: pagedIds },
          status: 'active',
        },
        include: {
          seller: {
            select: {
              id: true,
              storeName: true,
              storeSlug: true,
              storeAvatar: true,
              storeDesc: true,
              isVerified: true,
              isPremium: true,
              rating: true,
              totalSales: true,
              totalProducts: true,
              responseTime: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
          variants: true,
        },
      })

      // Create a map for O(1) lookup and preserve the desired order
      const productMap = new Map(fullProducts.map((p) => [p.id, p]))
      const orderedProducts = pagedIds
        .map((id) => productMap.get(id))
        .filter(Boolean)

      // Parse JSON fields
      products = orderedProducts.map((product) => ({
        ...product,
        images: parseJsonField((product as { images: string }).images),
        tags: parseJsonField((product as { tags: string | null }).tags),
      }))
    }

    const totalPages = Math.ceil(total / limit)

    logger.info(
      {
        query: q,
        category,
        sortBy,
        page,
        limit,
        total,
        duration: Date.now() - startTime,
      },
      'Search completed'
    )

    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: {
          products,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
          facets,
          query: q,
        },
      })
    )
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error(
      {
        err: error,
        duration: Date.now() - startTime,
      },
      'Search API error'
    )
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
