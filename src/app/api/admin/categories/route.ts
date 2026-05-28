import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

import { logger } from '@/lib/logger'
import { validateBody, adminCategoryCreateSchema, adminCategoryUpdateSchema, adminCategoryDeleteSchema } from '@/lib/validations'
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// GET /api/admin/categories - List all categories with product count, support ?parentId= for subcategories
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parentId')

    const where: Record<string, unknown> = {}
    if (parentId !== null) {
      where.parentId = parentId === 'null' ? null : parentId
    }

    const categories = await db.category.findMany({
      where,
      include: {
        _count: {
          select: { products: true, children: true },
        },
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    const mapped = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      image: cat.image,
      parentId: cat.parentId,
      parent: cat.parent,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      productCount: cat._count.products,
      childrenCount: cat._count.children,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }))

    return NextResponse.json({ success: true, data: mapped })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin categories GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/admin/categories - Create category
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const validation = validateBody(adminCategoryCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { name, icon, parentId, sortOrder, isActive } = validation.data
    const slug = (body as Record<string, unknown>).slug as string | undefined

    const categorySlug = slug || slugify(name)

    // Check slug uniqueness
    const existing = await db.category.findUnique({
      where: { slug: categorySlug },
    })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Category slug already exists' },
        { status: 409 }
      )
    }

    const image = (body as Record<string, unknown>).image as string | null | undefined

    const category = await db.category.create({
      data: {
        name,
        slug: categorySlug,
        icon: icon || null,
        image: image || null,
        parentId: parentId || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin categories POST error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/categories - Update category
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const validation = validateBody(adminCategoryUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { categoryId, name, icon, parentId, sortOrder, isActive } = validation.data
    const slug = (body as Record<string, unknown>).slug as string | undefined
    const image = (body as Record<string, unknown>).image as string | null | undefined

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) {
      updateData.name = name
      updateData.slug = slug || slugify(name)
    }
    if (slug !== undefined && name === undefined) updateData.slug = slug
    if (icon !== undefined) updateData.icon = icon
    if (image !== undefined) updateData.image = image
    if (parentId !== undefined) updateData.parentId = parentId || null
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (isActive !== undefined) updateData.isActive = isActive

    const category = await db.category.update({
      where: { id: categoryId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin categories PUT error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/categories - Soft delete by setting isActive=false
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const validation = validateBody(adminCategoryDeleteSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { categoryId } = validation.data

    const category = await db.category.update({
      where: { id: categoryId },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin categories DELETE error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
