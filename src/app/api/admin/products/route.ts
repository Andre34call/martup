import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'

import { parseJsonField } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

// GET /api/admin/products - Fetch ALL products (including blocked/draft) with seller info
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
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
              isVerified: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ])

    // Parse JSON fields
    const parsedProducts = products.map((product) => ({
      ...product,
      images: parseJsonField(product.images),
      tags: product.tags ? (() => { try { return JSON.parse(product.tags) } catch { return [] } })() : [],
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin products GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/products - Update product status & content (block, approve, edit, etc.)
export async function PUT(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { productId, status, isFeatured, name, description, price, discountPrice, images, videoUrl, categoryId, condition, weight, stock, tags } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    // Verify product exists
    const existing = await db.product.findUnique({ where: { id: productId } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}

    // Status & featured flags
    if (status !== undefined) {
      const validStatuses = ['active', 'draft', 'blocked', 'pending', 'rejected']
      if (!validStatuses.includes(status as string)) {
        return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
      }
      updateData.status = status
    }
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured

    // Content fields for moderation
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ success: false, error: 'Nama produk tidak boleh kosong' }, { status: 400 })
      }
      updateData.name = name.trim()
      // Auto-generate slug from name
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const slugWithId = `${slug}-${productId.slice(-6)}`
      updateData.slug = slugWithId
    }
    if (description !== undefined) updateData.description = description
    if (price !== undefined) {
      const priceNum = Number(price)
      if (isNaN(priceNum) || priceNum < 0) {
        return NextResponse.json({ success: false, error: 'Harga tidak valid' }, { status: 400 })
      }
      updateData.price = priceNum
    }
    if (discountPrice !== undefined) updateData.discountPrice = discountPrice || null
    if (images !== undefined) {
      // Validate images is array of strings, filter out blob URLs
      const validImages = Array.isArray(images)
        ? images.filter((img: string) => typeof img === 'string' && !img.startsWith('blob:'))
        : null
      updateData.images = validImages ? JSON.stringify(validImages) : existing.images
    }
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (condition !== undefined) updateData.condition = condition
    if (weight !== undefined) updateData.weight = Number(weight) || existing.weight
    if (stock !== undefined) {
      const stockNum = Number(stock)
      if (!isNaN(stockNum) && stockNum >= 0) updateData.stock = stockNum
    }
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl || null
    if (tags !== undefined) {
      const validTags = Array.isArray(tags)
        ? tags.filter((t: string) => typeof t === 'string' && t.trim().length > 0)
        : null
      updateData.tags = validTags ? JSON.stringify(validTags) : existing.tags
    }

    const product = await db.product.update({
      where: { id: productId },
      data: updateData,
    })

    // Create notification to seller about product edit if content was changed
    const contentFields = ['name', 'description', 'price', 'images', 'videoUrl', 'categoryId', 'condition', 'weight', 'stock', 'tags']
    const hasContentChange = contentFields.some(f => body[f] !== undefined)
    if (hasContentChange && existing.sellerId) {
      const seller = await db.seller.findUnique({
        where: { id: existing.sellerId },
        select: { userId: true },
      })
      if (seller?.userId) {
        await db.notification.create({
          data: {
            userId: seller.userId,
            title: 'Produk Diedit Admin',
            content: `Produk "${existing.name}" telah diedit oleh admin untuk moderasi.`,
            type: 'system',
            refType: 'product',
            refId: productId,
          },
        })
      }
    }

    return NextResponse.json(serializeDecimal({ success: true, data: product }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin products PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/products - Soft-delete product (set status to 'blocked')
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { productId } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    // Soft-delete: set status to 'blocked' instead of hard-deleting
    // Hard-delete causes referential integrity issues with orders, reviews, etc.
    const product = await db.product.update({
      where: { id: productId },
      data: { status: 'blocked' },
    })

    // Create notification to seller about product removal
    const productWithSeller = await db.product.findUnique({
      where: { id: productId },
      select: { seller: { select: { userId: true, storeName: true } }, name: true },
    })

    if (productWithSeller?.seller?.userId) {
      await db.notification.create({
        data: {
          userId: productWithSeller.seller.userId,
          title: 'Produk Dihapus Admin',
          content: `Produk "${productWithSeller.name}" telah dihapus oleh admin karena melanggar ketentuan platform.`,
          type: 'system',
          refType: 'product',
          refId: productId,
        },
      })
    }

    return NextResponse.json(serializeDecimal({ success: true, data: product }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin products DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
