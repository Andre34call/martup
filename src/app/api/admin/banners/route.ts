import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

import { logger } from '@/lib/logger'
// GET /api/admin/banners - Fetch all banners
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const banners = await db.banner.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ success: true, data: banners })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin banners GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/admin/banners - Create new banner
export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { title, image, link, position, isActive, sortOrder, startDate, endDate } = body

    if (!title || !image) {
      return NextResponse.json(
        { success: false, error: 'title and image are required' },
        { status: 400 }
      )
    }

    // SECURITY: Validate position enum
    const validPositions = ['home_top', 'home_mid', 'home_bottom', 'category_top', 'search_top', 'product_detail', 'checkout_top', 'popup']
    if (position !== undefined && !validPositions.includes(position)) {
      return NextResponse.json(
        { success: false, error: `Invalid position. Must be one of: ${validPositions.join(', ')}` },
        { status: 400 }
      )
    }

    const createData: { title: string; image: string; link?: string; position?: string; isActive?: boolean; sortOrder?: number; startDate?: Date; endDate?: Date } = { title, image }
    if (link !== undefined) createData.link = link
    if (position !== undefined) createData.position = position
    if (isActive !== undefined) createData.isActive = isActive
    if (sortOrder !== undefined) createData.sortOrder = sortOrder
    if (startDate !== undefined) createData.startDate = new Date(startDate)
    if (endDate !== undefined) createData.endDate = new Date(endDate)

    const banner = await db.banner.create({ data: createData })

    return NextResponse.json({ success: true, data: banner })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin banners POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/banners - Update banner
export async function PUT(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { bannerId, title, image, link, position, isActive, sortOrder } = body

    if (!bannerId) {
      return NextResponse.json(
        { success: false, error: 'bannerId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Validate position enum
    const validPositions = ['home_top', 'home_mid', 'home_bottom', 'category_top', 'search_top', 'product_detail', 'checkout_top', 'popup']
    if (position !== undefined && !validPositions.includes(position)) {
      return NextResponse.json(
        { success: false, error: `Invalid position. Must be one of: ${validPositions.join(', ')}` },
        { status: 400 }
      )
    }

    const updateData: { title?: string; image?: string; link?: string; position?: string; isActive?: boolean; sortOrder?: number } = {}
    if (title !== undefined) updateData.title = title
    if (image !== undefined) updateData.image = image
    if (link !== undefined) updateData.link = link
    if (position !== undefined) updateData.position = position
    if (isActive !== undefined) updateData.isActive = isActive
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder

    const banner = await db.banner.update({
      where: { id: bannerId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: banner })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin banners PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/banners - Delete banner
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { bannerId } = body

    if (!bannerId) {
      return NextResponse.json(
        { success: false, error: 'bannerId is required' },
        { status: 400 }
      )
    }

    const banner = await db.banner.delete({
      where: { id: bannerId },
    })

    return NextResponse.json({ success: true, data: banner })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin banners DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
