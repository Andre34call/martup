import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/admin/banners - List all banners
export async function GET() {
  try {
    const banners = await db.banner.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    const formattedBanners = banners.map((b) => ({
      id: b.id,
      title: b.title,
      image: b.image,
      link: b.link,
      position: b.position,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
      startDate: b.startDate,
      endDate: b.endDate,
      createdAt: b.createdAt,
    }))

    return NextResponse.json({
      success: true,
      banners: formattedBanners,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin banners GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/admin/banners - Create a new banner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, image, link, position, sortOrder, isActive, startDate, endDate } = body

    if (!title || !image) {
      return NextResponse.json(
        { success: false, error: 'Title and image are required' },
        { status: 400 }
      )
    }

    const banner = await db.banner.create({
      data: {
        title,
        image,
        link: link || null,
        position: position || 'home_top',
        sortOrder: sortOrder ?? 0,
        isActive: isActive !== undefined ? isActive : true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    })

    return NextResponse.json({
      success: true,
      banner: {
        id: banner.id,
        title: banner.title,
        image: banner.image,
        link: banner.link,
        position: banner.position,
        sortOrder: banner.sortOrder,
        isActive: banner.isActive,
        startDate: banner.startDate,
        endDate: banner.endDate,
        createdAt: banner.createdAt,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin banners POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/banners - Update a banner
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { bannerId, updates } = body

    if (!bannerId) {
      return NextResponse.json(
        { success: false, error: 'bannerId is required' },
        { status: 400 }
      )
    }

    const allowedFields = ['title', 'image', 'link', 'position', 'sortOrder', 'isActive', 'startDate', 'endDate']
    const filteredUpdates: Record<string, unknown> = {}

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key]
      }
    }

    // Convert date strings to Date objects
    if (filteredUpdates.startDate) {
      filteredUpdates.startDate = new Date(filteredUpdates.startDate as string)
    }
    if (filteredUpdates.endDate) {
      filteredUpdates.endDate = new Date(filteredUpdates.endDate as string)
    }

    const banner = await db.banner.update({
      where: { id: bannerId },
      data: filteredUpdates,
    })

    return NextResponse.json({
      success: true,
      banner: {
        id: banner.id,
        title: banner.title,
        image: banner.image,
        link: banner.link,
        position: banner.position,
        sortOrder: banner.sortOrder,
        isActive: banner.isActive,
        startDate: banner.startDate,
        endDate: banner.endDate,
        createdAt: banner.createdAt,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin banners PATCH error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/banners - Delete a banner
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bannerId = searchParams.get('bannerId')

    if (!bannerId) {
      return NextResponse.json(
        { success: false, error: 'bannerId is required' },
        { status: 400 }
      )
    }

    await db.banner.delete({ where: { id: bannerId } })

    return NextResponse.json({
      success: true,
      message: 'Banner deleted successfully',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin banners DELETE error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
