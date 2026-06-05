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

// GET /api/products - Fetch all active products with seller and category info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    const isFlashSale = searchParams.get('isFlashSale')
    const sellerId = searchParams.get('sellerId')
    const productType = searchParams.get('productType')
    // SECURITY: Cap limit to prevent excessive queries (DoS prevention)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)

    // Build where clause
    const where: Record<string, unknown> = {
      status: 'active',
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (sellerId) {
      where.sellerId = sellerId
    }

    if (isFlashSale === 'true') {
      where.isFlashSale = true
    }

    if (productType && ['product', 'jasa'].includes(productType)) {
      where.productType = productType
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.product.count({ where }),
    ])

    // Parse JSON fields in products
    const parsedProducts = products.map((product) => ({
      ...product,
      images: parseJsonField(product.images),
      tags: parseJsonField(product.tags),
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedProducts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Products GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
