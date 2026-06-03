import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { serializeDecimal } from '@/lib/decimal-utils'

import { logger } from '@/lib/logger'
// Rate limiter: 30 cart update operations per minute
const cartPutLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:cart:put:' })

const MAX_QUANTITY = 99

// Helper: safely parse JSON field
function safeJsonParse(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const cartItemInclude = {
  product: {
    include: {
      seller: { select: { id: true, storeName: true, storeSlug: true, storeAvatar: true, isVerified: true, isPremium: true, rating: true, totalSales: true } },
      variants: true,
    },
  },
  variant: true,
}

// PUT /api/cart/[id] - Update a cart item (SECURED with verifyAuth + ownership check)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const userId = authResult.user.id

    // Rate limit
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await cartPutLimiter.check(`${clientIp}:${userId}`)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const existing = await db.cartItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Item keranjang tidak ditemukan' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the cart item belongs to the authenticated user
    if (existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Anda hanya bisa mengubah item keranjang sendiri' },
        { status: 403 }
      )
    }

    const updateData: Record<string, unknown> = {}

    if (body.quantity !== undefined) {
      const qty = body.quantity
      if (qty < 1 || qty > MAX_QUANTITY) {
        return NextResponse.json(
          { success: false, error: `Quantity harus antara 1 dan ${MAX_QUANTITY}` },
          { status: 400 }
        )
      }

      // Validate stock availability
      if (existing.variantId) {
        const variant = await db.productVariant.findUnique({
          where: { id: existing.variantId },
          select: { stock: true, name: true },
        })
        if (variant && qty > variant.stock) {
          return NextResponse.json(
            { success: false, error: `Stok varian "${variant.name}" tidak mencukupi. Tersedia: ${variant.stock}` },
            { status: 400 }
          )
        }
      } else {
        const product = await db.product.findUnique({
          where: { id: existing.productId },
          select: { stock: true, name: true },
        })
        if (product && qty > product.stock) {
          return NextResponse.json(
            { success: false, error: `Stok "${product.name}" tidak mencukupi. Tersedia: ${product.stock}` },
            { status: 400 }
          )
        }
      }

      updateData.quantity = qty
    }

    if (body.isChecked !== undefined) {
      updateData.isChecked = body.isChecked
    }

    const updated = await db.cartItem.update({
      where: { id },
      data: updateData,
      include: cartItemInclude,
    })

    const responseItem = {
      ...updated,
      product: updated.product
        ? {
            ...updated.product,
            images: safeJsonParse(updated.product.images as unknown as string),
          }
        : null,
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: responseItem,
    }))
  } catch (error) {
    logger.error({ err: error }, 'Update cart item error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/cart/[id] - Remove a cart item (SECURED with verifyAuth + ownership check)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const userId = authResult.user.id

    const { id } = await params

    const existing = await db.cartItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Item keranjang tidak ditemukan' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the cart item belongs to the authenticated user
    if (existing.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Anda hanya bisa menghapus item keranjang sendiri' },
        { status: 403 }
      )
    }

    await db.cartItem.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      message: 'Item berhasil dihapus dari keranjang',
    })
  } catch (error) {
    logger.error({ err: error }, 'Delete cart item error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
