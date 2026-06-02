import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

// PUT /api/admin/products/promote - Set/unset product as promoted (paid ad)
export async function PUT(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { productId, isPromoted, promotedDays } = body as {
      productId?: string
      isPromoted?: boolean
      promotedDays?: number
    }

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    if (typeof isPromoted !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isPromoted boolean is required' },
        { status: 400 }
      )
    }

    const existing = await db.product.findUnique({ where: { id: productId } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = { isPromoted }

    if (isPromoted) {
      // Set promotion with duration
      const days = promotedDays && promotedDays > 0 ? promotedDays : 30 // default 30 days
      const promotedUntil = new Date()
      promotedUntil.setDate(promotedUntil.getDate() + days)
      updateData.promotedUntil = promotedUntil
      updateData.promotedBy = authResult.user.id
    } else {
      // Remove promotion
      updateData.promotedUntil = null
      updateData.promotedBy = null
    }

    const product = await db.product.update({
      where: { id: productId },
      data: updateData,
    })

    // Notify seller about promotion status change
    const seller = await db.seller.findUnique({
      where: { id: existing.sellerId },
      select: { userId: true },
    })
    if (seller?.userId) {
      await db.notification.create({
        data: {
          userId: seller.userId,
          title: isPromoted ? 'Produk Dipromosikan' : 'Promosi Dihapus',
          content: isPromoted
            ? `Produk "${existing.name}" telah dipromosikan oleh admin dan akan tampil di halaman utama.`
            : `Promosi untuk produk "${existing.name}" telah dihapus.`,
          type: 'promo',
          refType: 'product',
          refId: productId,
        },
      })
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        isPromoted: product.isPromoted,
        promotedUntil: product.promotedUntil,
        promotedBy: product.promotedBy,
      },
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Admin promote PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
