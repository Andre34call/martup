import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'
import { parseProductJsonFields } from '@/lib/json-utils'

// Shared include for cart item product details
const cartItemInclude = {
  product: {
    include: {
      seller: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          storeAvatar: true,
          isVerified: true,
          isPremium: true,
          rating: true,
          totalSales: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      variants: true,
    },
  },
  variant: true,
} as const

// Helper to parse cart item JSON fields for response
function parseCartItemFields<T extends { product: Record<string, unknown> | null }>(item: T) {
  return {
    ...item,
    product: item.product
      ? (parseProductJsonFields(item.product as unknown as Record<string, unknown>) as unknown as T['product'])
      : item.product,
  }
}

// PUT /api/cart/bulk - Bulk update cart items (isChecked) in a single transaction
export async function PUT(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`cart-bulk:${clientIp}:${authResult.user.id}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { items } = body as { items: Array<{ cartItemId: string; isChecked?: boolean }> }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items array is required and must not be empty' },
        { status: 400 }
      )
    }

    if (items.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 items per bulk update' },
        { status: 400 }
      )
    }

    const userId = authResult.user.id

    // SECURITY: Verify all cart items belong to the authenticated user
    const cartItemIds = items.map(i => i.cartItemId)
    const existingItems = await db.cartItem.findMany({
      where: { id: { in: cartItemIds } },
      select: { id: true, userId: true },
    })

    const forbiddenItems = existingItems.filter(item => item.userId !== userId)
    if (forbiddenItems.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only update your own cart items' },
        { status: 403 }
      )
    }

    const foundIds = new Set(existingItems.map(item => item.id))
    const notFoundIds = cartItemIds.filter(id => !foundIds.has(id))
    if (notFoundIds.length > 0) {
      return NextResponse.json(
        { success: false, error: `Cart item(s) not found: ${notFoundIds.join(', ')}` },
        { status: 404 }
      )
    }

    // Update all items in a single transaction
    const updatedItems = await db.$transaction(
      items.map(item =>
        db.cartItem.update({
          where: { id: item.cartItemId },
          data: {
            ...(item.isChecked !== undefined ? { isChecked: item.isChecked } : {}),
          },
          include: cartItemInclude,
        })
      )
    )

    const parsedItems = updatedItems.map(item => parseCartItemFields(item))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedItems,
      message: `${updatedItems.length} cart items updated`,
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Cart bulk PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
