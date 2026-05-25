import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

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

    return NextResponse.json({
      success: true,
      data: parsedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin products GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/products - Update product status (block, approve, etc.)
export async function PUT(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { productId, status, isFeatured } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured

    const product = await db.product.update({
      where: { id: productId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin products PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/products - Delete product
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

    const product = await db.product.delete({
      where: { id: productId },
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin products DELETE error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
