import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

import { logger } from '@/lib/logger'
// GET /api/categories - Fetch categories with sub-categories (hierarchical)
// Query params:
//   parentId: optional - filter by parentId ("null" for root categories, or a category ID)
//   If no parentId, returns root categories with nested children
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parentIdParam = searchParams.get('parentId')

    const now = new Date()

    if (parentIdParam !== null) {
      // Specific parentId filter requested
      const parentId = parentIdParam === 'null' ? null : parentIdParam

      const categories = await db.category.findMany({
        where: {
          isActive: true,
          parentId: parentId,
        },
        include: {
          _count: {
            select: {
              products: {
                where: { status: 'active' },
              },
            },
          },
          children: {
            where: { isActive: true },
            include: {
              _count: {
                select: {
                  products: {
                    where: { status: 'active' },
                  },
                },
              },
              children: {
                where: { isActive: true },
                include: {
                  _count: {
                    select: {
                      products: {
                        where: { status: 'active' },
                      },
                    },
                  },
                },
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      })

      const data = categories.map(transformCategory)

      return NextResponse.json({
        success: true,
        data,
        timestamp: now.toISOString(),
      })
    }

    // No parentId: return root categories with fully nested children
    const rootCategories = await db.category.findMany({
      where: {
        isActive: true,
        parentId: null,
      },
      include: {
        _count: {
          select: {
            products: {
              where: { status: 'active' },
            },
          },
        },
        children: {
          where: { isActive: true },
          include: {
            _count: {
              select: {
                products: {
                  where: { status: 'active' },
                },
              },
            },
            children: {
              where: { isActive: true },
              include: {
                _count: {
                  select: {
                    products: {
                      where: { status: 'active' },
                    },
                  },
                },
                children: {
                  where: { isActive: true },
                  include: {
                    _count: {
                      select: {
                        products: {
                          where: { status: 'active' },
                        },
                      },
                    },
                  },
                  orderBy: { sortOrder: 'asc' },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const data = rootCategories.map(transformCategory)

    return NextResponse.json({
      success: true,
      data,
      timestamp: now.toISOString(),
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Categories GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// Recursively transform category with nested children
function transformCategory(category: Record<string, unknown>): Record<string, unknown> {
  const { _count, children, ...rest } = category

  const result: Record<string, unknown> = {
    ...rest,
    productCount: (_count as Record<string, number>)?.products ?? 0,
  }

  if (children && Array.isArray(children)) {
    result.children = children.map(transformCategory)
  } else {
    result.children = []
  }

  return result
}
