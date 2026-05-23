import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/categories - Fetch all active categories with product count
export async function GET(request: NextRequest) {
  try {
    const categories = await db.category.findMany({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: {
            products: {
              where: { status: 'active' },
            },
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })

    // Transform to include productCount
    const data = categories.map(({ _count, ...category }) => ({
      ...category,
      productCount: _count.products,
    }))

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Categories GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
