import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
