import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'

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

// GET /api/seller/products - Fetch products for a specific seller
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')

    if (!sellerId) {
      return NextResponse.json(
        { success: false, error: 'sellerId is required' },
        { status: 400 }
      )
    }

    const products = await db.product.findMany({
      where: { sellerId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        variants: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Parse JSON fields
    const parsedProducts = products.map((product) => ({
      ...product,
      images: parseJsonField(product.images),
      tags: parseJsonField(product.tags),
    }))

    return NextResponse.json({
      success: true,
      data: parsedProducts,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Seller Products GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/seller/products - Create a new product with variants
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sellerId,
      categoryId,
      name,
      slug,
      description,
      price,
      discountPrice,
      images,
      videoUrl,
      stock,
      minOrder = 1,
      weight,
      condition = 'new',
      status = 'active',
      isFeatured = false,
      isFlashSale = false,
      flashSaleEnd,
      tags,
      variants = [],
    } = body

    // Validate required fields
    if (!sellerId) {
      return NextResponse.json(
        { success: false, error: 'sellerId is required' },
        { status: 400 }
      )
    }
    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'categoryId is required' },
        { status: 400 }
      )
    }
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      )
    }
    if (!description) {
      return NextResponse.json(
        { success: false, error: 'description is required' },
        { status: 400 }
      )
    }
    if (price === undefined || price === null) {
      return NextResponse.json(
        { success: false, error: 'price is required' },
        { status: 400 }
      )
    }
    if (weight === undefined || weight === null) {
      return NextResponse.json(
        { success: false, error: 'weight is required' },
        { status: 400 }
      )
    }

    // Generate slug if not provided
    const productSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    // Check slug uniqueness
    const existingSlug = await db.product.findUnique({ where: { slug: productSlug } })
    if (existingSlug) {
      return NextResponse.json(
        { success: false, error: 'Product slug already exists' },
        { status: 409 }
      )
    }

    // Stringify JSON fields for storage
    const imagesStr = typeof images === 'string' ? images : JSON.stringify(images || [])
    const tagsStr = typeof tags === 'string' ? tags : (tags ? JSON.stringify(tags) : null)

    const product = await db.product.create({
      data: {
        sellerId,
        categoryId,
        name,
        slug: productSlug,
        description,
        price,
        discountPrice: discountPrice || null,
        images: imagesStr,
        videoUrl: videoUrl || null,
        stock: stock || 0,
        minOrder,
        weight,
        condition,
        status,
        isFeatured,
        isFlashSale,
        flashSaleEnd: flashSaleEnd ? new Date(flashSaleEnd) : null,
        tags: tagsStr,
        variants: {
          create: variants.map((v: {
            name: string
            value: string
            sku?: string | null
            price?: number | null
            stock?: number
            image?: string | null
          }) => ({
            name: v.name,
            value: v.value,
            sku: v.sku || null,
            price: v.price || null,
            stock: v.stock || 0,
            image: v.image || null,
          })),
        },
      },
      include: {
        category: true,
        variants: true,
      },
    })

    // Update seller total products count
    await db.seller.update({
      where: { id: sellerId },
      data: { totalProducts: { increment: 1 } },
    })

    // Parse JSON fields in response
    const parsedProduct = {
      ...product,
      images: parseJsonField(product.images),
      tags: parseJsonField(product.tags),
    }

    return NextResponse.json({
      success: true,
      data: parsedProduct,
    }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Seller Products POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/seller/products - Update a product
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Rate limit: max 20 operations per minute
    const rateLimitId = `seller-products-put-${authResult.user.id}`
    if (!checkRateLimit(rateLimitId, 20)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 20 operations per minute.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const {
      productId,
      categoryId,
      name,
      slug,
      description,
      price,
      discountPrice,
      images,
      videoUrl,
      stock,
      minOrder,
      weight,
      condition,
      status,
      isFeatured,
      isFlashSale,
      flashSaleEnd,
      tags,
      variants,
    } = body

    // Validate required productId
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    // Validate numeric fields if provided
    if (price !== undefined && price !== null && price < 0) {
      return NextResponse.json(
        { success: false, error: 'price must be >= 0' },
        { status: 400 }
      )
    }
    if (discountPrice !== undefined && discountPrice !== null && discountPrice < 0) {
      return NextResponse.json(
        { success: false, error: 'discountPrice must be >= 0' },
        { status: 400 }
      )
    }
    if (stock !== undefined && stock !== null && stock < 0) {
      return NextResponse.json(
        { success: false, error: 'stock must be >= 0' },
        { status: 400 }
      )
    }
    if (minOrder !== undefined && minOrder !== null && minOrder < 1) {
      return NextResponse.json(
        { success: false, error: 'minOrder must be >= 1' },
        { status: 400 }
      )
    }
    if (weight !== undefined && weight !== null && weight < 0) {
      return NextResponse.json(
        { success: false, error: 'weight must be >= 0' },
        { status: 400 }
      )
    }

    // Validate condition if provided
    if (condition !== undefined && !['new', 'used'].includes(condition)) {
      return NextResponse.json(
        { success: false, error: 'condition must be "new" or "used"' },
        { status: 400 }
      )
    }

    // Validate status if provided
    if (status !== undefined && !['active', 'draft', 'blocked'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'status must be "active", "draft", or "blocked"' },
        { status: 400 }
      )
    }

    // Fetch the product and verify ownership
    const existingProduct = await db.product.findUnique({
      where: { id: productId },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the product belongs to the authenticated seller
    // Find the seller record for this user
    const seller = await db.seller.findFirst({
      where: { userId: authResult.user.id },
    })

    if (!seller || existingProduct.sellerId !== seller.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only edit your own products' },
        { status: 403 }
      )
    }

    // If slug is being updated, check uniqueness
    if (slug && slug !== existingProduct.slug) {
      const existingSlug = await db.product.findUnique({ where: { slug } })
      if (existingSlug) {
        return NextResponse.json(
          { success: false, error: 'Product slug already exists' },
          { status: 409 }
        )
      }
    }

    // Build update data object with only provided fields
    const updateData: Record<string, unknown> = {}

    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug
    if (description !== undefined) updateData.description = description
    if (price !== undefined) updateData.price = price
    if (discountPrice !== undefined) updateData.discountPrice = discountPrice || null
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl || null
    if (stock !== undefined) updateData.stock = stock
    if (minOrder !== undefined) updateData.minOrder = minOrder
    if (weight !== undefined) updateData.weight = weight
    if (condition !== undefined) updateData.condition = condition
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured
    if (isFlashSale !== undefined) updateData.isFlashSale = isFlashSale
    if (flashSaleEnd !== undefined) updateData.flashSaleEnd = flashSaleEnd ? new Date(flashSaleEnd) : null

    // Stringify JSON fields for storage
    if (images !== undefined) {
      updateData.images = typeof images === 'string' ? images : JSON.stringify(images || [])
    }
    if (tags !== undefined) {
      updateData.tags = typeof tags === 'string' ? tags : (tags ? JSON.stringify(tags) : null)
    }

    // Track status change for seller totalProducts update
    const oldStatus = existingProduct.status
    const newStatus = status !== undefined ? status : oldStatus
    const becameActive = oldStatus !== 'active' && newStatus === 'active'
    const leftActive = oldStatus === 'active' && newStatus !== 'active'

    // Handle variants update: delete existing and create new ones
    if (variants !== undefined) {
      // Use a transaction to ensure atomicity
      const updatedProduct = await db.$transaction(async (tx) => {
        // Delete existing variants
        await tx.productVariant.deleteMany({
          where: { productId },
        })

        // Update product with new data and create new variants
        const product = await tx.product.update({
          where: { id: productId },
          data: {
            ...updateData,
            status: status !== undefined ? status : undefined,
            variants: {
              create: variants.map((v: {
                name: string
                value: string
                sku?: string | null
                price?: number | null
                stock?: number
                image?: string | null
              }) => ({
                name: v.name,
                value: v.value,
                sku: v.sku || null,
                price: v.price || null,
                stock: v.stock || 0,
                image: v.image || null,
              })),
            },
          },
          include: {
            category: true,
            variants: true,
          },
        })

        // Update seller totalProducts count if status changed to/from active
        if (becameActive) {
          await tx.seller.update({
            where: { id: seller.id },
            data: { totalProducts: { increment: 1 } },
          })
        } else if (leftActive) {
          await tx.seller.update({
            where: { id: seller.id },
            data: { totalProducts: { decrement: 1 } },
          })
        }

        return product
      })

      // Parse JSON fields in response
      const parsedProduct = {
        ...updatedProduct,
        images: parseJsonField(updatedProduct.images),
        tags: parseJsonField(updatedProduct.tags),
      }

      return NextResponse.json({
        success: true,
        data: parsedProduct,
      })
    }

    // No variants update - simpler path without transaction
    const updatedProduct = await db.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: productId },
        data: {
          ...updateData,
          status: status !== undefined ? status : undefined,
        },
        include: {
          category: true,
          variants: true,
        },
      })

      // Update seller totalProducts count if status changed to/from active
      if (becameActive) {
        await tx.seller.update({
          where: { id: seller.id },
          data: { totalProducts: { increment: 1 } },
        })
      } else if (leftActive) {
        await tx.seller.update({
          where: { id: seller.id },
          data: { totalProducts: { decrement: 1 } },
        })
      }

      return product
    })

    // Parse JSON fields in response
    const parsedProduct = {
      ...updatedProduct,
      images: parseJsonField(updatedProduct.images),
      tags: parseJsonField(updatedProduct.tags),
    }

    return NextResponse.json({
      success: true,
      data: parsedProduct,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Seller Products PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// DELETE /api/seller/products - Soft delete a product (set status to 'blocked')
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Rate limit: max 20 operations per minute
    const rateLimitId = `seller-products-delete-${authResult.user.id}`
    if (!checkRateLimit(rateLimitId, 20)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 20 operations per minute.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { productId } = body

    // Validate required productId
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    // Fetch the product and verify ownership
    const existingProduct = await db.product.findUnique({
      where: { id: productId },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the product belongs to the authenticated seller
    const seller = await db.seller.findFirst({
      where: { userId: authResult.user.id },
    })

    if (!seller || existingProduct.sellerId !== seller.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only delete your own products' },
        { status: 403 }
      )
    }

    // Check if already soft-deleted
    if (existingProduct.status === 'blocked') {
      return NextResponse.json(
        { success: false, error: 'Product is already deleted' },
        { status: 400 }
      )
    }

    // Soft delete: set status to 'blocked' and decrement seller totalProducts if was active
    const wasActive = existingProduct.status === 'active'

    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { status: 'blocked' },
      })

      // Decrement seller totalProducts count only if product was active
      if (wasActive) {
        await tx.seller.update({
          where: { id: seller.id },
          data: { totalProducts: { decrement: 1 } },
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: { productId, status: 'blocked' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Seller Products DELETE error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
