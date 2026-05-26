import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { sanitizeInput, sanitizeRichContent } from '@/lib/sanitize'

import { logger } from '@/lib/logger'
// Helper: safely parse JSON field
function safeJsonParse(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// GET /api/products/[id] - Get product detail (PUBLIC, no auth required)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const product = await db.product.findUnique({
      where: { id },
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
          },
        },
        variants: true,
        reviews: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    })

    if (!product || product.status === 'draft') {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields safely (no more try/catch crash risk)
    const responseProduct = {
      ...product,
      images: safeJsonParse(product.images),
      tags: safeJsonParse(product.tags),
      reviews: product.reviews.map((review) => ({
        ...review,
        images: safeJsonParse(review.images),
      })),
    }

    return NextResponse.json({
      success: true,
      data: responseProduct,
    })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/products/[id] error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Update product (SECURED with verifyAuth + seller check)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Unified auth using verifyAuth (not requireSeller from auth-helpers)
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Rate limit
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`product-put:${clientIp}:${authResult.user.id}`, 15)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    // Verify seller account
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
    })

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Seller account required' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Verify product exists and belongs to this seller
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }
    if (existing.sellerId !== seller.id) {
      return NextResponse.json(
        { success: false, error: 'You can only update your own products' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      description,
      price,
      discountPrice,
      stock,
      categoryId,
      images,
      weight,
      condition,
      minOrder,
      tags,
    } = body as {
      name?: string
      description?: string
      price?: number
      discountPrice?: number | null
      stock?: number
      categoryId?: string
      images?: string[]
      weight?: number
      condition?: string
      minOrder?: number
      tags?: string[]
    }

    // SECURITY: Sanitize text inputs
    const sanitizedName = name !== undefined ? sanitizeInput(name) : undefined
    const sanitizedDescription = description !== undefined ? sanitizeRichContent(description) : undefined
    const sanitizedCondition = condition !== undefined ? sanitizeInput(condition) : undefined

    // Validate price if provided
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return NextResponse.json(
        { success: false, error: 'Price must be a positive number' },
        { status: 400 }
      )
    }
    if (discountPrice !== undefined && discountPrice !== null && (typeof discountPrice !== 'number' || discountPrice < 0)) {
      return NextResponse.json(
        { success: false, error: 'Discount price must be a positive number or null' },
        { status: 400 }
      )
    }
    if (stock !== undefined && (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock))) {
      return NextResponse.json(
        { success: false, error: 'Stock must be a non-negative integer' },
        { status: 400 }
      )
    }

    // Validate images array if provided
    if (images !== undefined && !Array.isArray(images)) {
      return NextResponse.json(
        { success: false, error: 'Images must be an array' },
        { status: 400 }
      )
    }

    // If name is being updated, regenerate slug
    let slug = existing.slug
    if (sanitizedName && sanitizedName !== existing.name) {
      const baseSlug = sanitizedName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      const slugConflict = await db.product.findFirst({
        where: { slug: baseSlug, NOT: { id } },
      })
      slug = slugConflict ? `${baseSlug}-${Date.now()}` : baseSlug
    }

    // If categoryId is being changed, verify it exists
    if (categoryId && categoryId !== existing.categoryId) {
      const category = await db.category.findUnique({ where: { id: categoryId } })
      if (!category) {
        return NextResponse.json(
          { success: false, error: 'Category not found' },
          { status: 400 }
        )
      }
    }

    const updated = await db.product.update({
      where: { id },
      data: {
        ...(sanitizedName !== undefined && { name: sanitizedName }),
        ...(sanitizedDescription !== undefined && { description: sanitizedDescription }),
        ...(price !== undefined && { price }),
        ...(discountPrice !== undefined && { discountPrice }),
        ...(stock !== undefined && { stock }),
        ...(categoryId !== undefined && { categoryId }),
        ...(images !== undefined && { images: JSON.stringify(images) }),
        ...(weight !== undefined && { weight }),
        ...(sanitizedCondition !== undefined && { condition: sanitizedCondition }),
        ...(minOrder !== undefined && { minOrder }),
        ...(tags !== undefined && { tags: tags ? JSON.stringify(tags) : null }),
        slug,
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
            isVerified: true,
            rating: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        variants: true,
      },
    })

    // Parse JSON fields safely for response
    const responseProduct = {
      ...updated,
      images: safeJsonParse(updated.images),
      tags: safeJsonParse(updated.tags),
    }

    return NextResponse.json({
      success: true,
      data: responseProduct,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'PUT /api/products/[id] error')
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Soft delete product (SECURED with verifyAuth + seller check)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Unified auth using verifyAuth
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Verify seller account
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
    })

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Seller account required' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Verify product exists and belongs to this seller
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }
    if (existing.sellerId !== seller.id) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own products' },
        { status: 403 }
      )
    }

    // Soft delete - set status to draft
    await db.product.update({
      where: { id },
      data: { status: 'draft' },
    })

    // Decrement seller totalProducts
    await db.seller.update({
      where: { id: seller.id },
      data: { totalProducts: { decrement: 1 } },
    })

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'DELETE /api/products/[id] error')
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}
