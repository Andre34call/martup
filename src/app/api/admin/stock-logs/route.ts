import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

// GET /api/admin/stock-logs - Fetch stock change history with filtering
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const type = searchParams.get('type')
    const createdBy = searchParams.get('createdBy')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (productId) {
      where.productId = productId
    }

    if (type) {
      where.type = type
    }

    if (createdBy) {
      where.createdBy = createdBy
    }

    // Date range filter
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}
      if (dateFrom) createdAt.gte = new Date(dateFrom)
      if (dateTo) createdAt.lte = new Date(dateTo)
      where.createdAt = createdAt
    }

    const [logs, total] = await Promise.all([
      db.stockLog.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: true,
              seller: {
                select: {
                  id: true,
                  storeName: true,
                },
              },
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              value: true,
              sku: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.stockLog.count({ where }),
    ])

    // Parse product images JSON field
    const parsedLogs = logs.map((log) => ({
      ...log,
      product: log.product
        ? {
            ...log.product,
            images: (() => {
              try {
                const parsed = JSON.parse(log.product.images as string)
                return Array.isArray(parsed) ? parsed : []
              } catch {
                return []
              }
            })(),
          }
        : log.product,
    }))

    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: parsedLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'Admin stock logs GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
