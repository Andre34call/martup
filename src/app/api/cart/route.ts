import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiGuard } from '@/lib/api-guard'
import { cartAddSchema, cartMergeSchema, cartUpdateSchema, cartDeleteSchema, validateBody } from '@/lib/validations'
import { successResponse, errorResponse, parseRequestBody } from '@/lib/api-utils'
import { serializeDecimal } from '@/lib/decimal-utils'
import { cartItemInclude } from '@/lib/db-includes'
import { parseCartItemFields } from '@/lib/json-utils'
import { logger } from '@/lib/logger'

const MAX_QUANTITY = 99

// GET /api/cart - List user's cart items with product details
export async function GET(request: NextRequest) {
  try {
    const guard = await apiGuard(request, { auth: 'user', csrf: false })
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return errorResponse('userId is required', 400)
    }

    // SECURITY: Users can only access their own cart
    if (userId !== guard.user!.id) {
      return errorResponse('Forbidden - You can only access your own cart', 403)
    }

    const cartItems = await db.cartItem.findMany({
      where: { userId },
      include: cartItemInclude,
      orderBy: { createdAt: 'desc' },
    })

    // Parse JSON fields in products
    const parsedCartItems = cartItems.map((item) => parseCartItemFields(item))

    return successResponse(serializeDecimal(parsedCartItems))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Cart GET error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}

// POST /api/cart - Add item to cart (or merge/clear via query params)
export async function POST(request: NextRequest) {
  try {
    // Use guard without schema — body validation depends on mode (add/merge/clear)
    const guard = await apiGuard(request, {
      auth: 'user',
      rateLimit: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:cart:' },
    })
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(request.url)
    const merge = searchParams.get('merge') === 'true'
    const clear = searchParams.get('clear') === 'true'

    const userId = guard.user!.id

    // POST /api/cart?clear=true - Clear all cart items for the user
    if (clear) {
      await db.cartItem.deleteMany({
        where: { userId },
      })

      return successResponse(null, 'Cart cleared successfully')
    }

    // Parse body for merge and add modes
    const body = await parseRequestBody(request)
    if (body instanceof NextResponse) return body

    // POST /api/cart?merge=true - Merge localStorage cart into DB
    if (merge) {
      const validation = validateBody(cartMergeSchema, body)
      if (!validation.success) {
        return errorResponse(validation.error, 422)
      }
      const { items } = validation.data

      const mergedItems: Array<Record<string, unknown>> = []

      for (const item of items) {
        if (!item.productId || !item.quantity || item.quantity < 1) continue

        // Validate product exists and is active
        const product = await db.product.findUnique({
          where: { id: item.productId },
          select: { id: true, status: true, stock: true, name: true },
        })

        if (!product || product.status !== 'active') continue

        // Validate variant if provided
        if (item.variantId) {
          const variant = await db.productVariant.findUnique({
            where: { id: item.variantId },
            select: { id: true, productId: true, stock: true, name: true },
          })

          if (!variant || variant.productId !== item.productId) continue

          if (variant.stock < item.quantity) continue
        } else {
          if (product.stock < item.quantity) continue
        }

        // Upsert: find existing cart item with same userId+productId+variantId
        const existingItem = await db.cartItem.findFirst({
          where: {
            userId,
            productId: item.productId,
            variantId: item.variantId || null,
          },
        })

        let cartItem
        if (existingItem) {
          // Increment quantity, capped at MAX_QUANTITY
          const newQuantity = Math.min(existingItem.quantity + item.quantity, MAX_QUANTITY)
          cartItem = await db.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQuantity },
            include: cartItemInclude,
          })
        } else {
          cartItem = await db.cartItem.create({
            data: {
              userId,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: Math.min(item.quantity, MAX_QUANTITY),
            },
            include: cartItemInclude,
          })
        }

        mergedItems.push(parseCartItemFields(cartItem))
      }

      return successResponse(
        serializeDecimal(mergedItems),
        `Merged ${mergedItems.length} items into cart`,
      )
    }

    // POST /api/cart - Add a single item to cart
    const validation = validateBody(cartAddSchema, body)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }
    const { productId, variantId, quantity } = validation.data

    // Validate product exists and is active
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true, stock: true, name: true },
    })

    if (!product) {
      return errorResponse('Product not found', 404)
    }

    if (product.status !== 'active') {
      return errorResponse('Product is not available', 400)
    }

    // Validate variant if provided
    if (variantId) {
      const variant = await db.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, stock: true, name: true },
      })

      if (!variant) {
        return errorResponse('Variant not found', 404)
      }

      if (variant.productId !== productId) {
        return errorResponse('Variant does not belong to this product', 400)
      }

      // Check variant stock availability
      const existingCartItem = await db.cartItem.findFirst({
        where: { userId, productId, variantId },
      })
      const currentQty = existingCartItem ? existingCartItem.quantity : 0
      const totalQty = currentQty + quantity

      if (totalQty > variant.stock) {
        return errorResponse(
          `Insufficient stock for variant "${variant.name}". Available: ${variant.stock}, In cart: ${currentQty}, Requested additional: ${quantity}`,
          400,
        )
      }

      if (totalQty > MAX_QUANTITY) {
        return errorResponse(
          `Maximum quantity per item is ${MAX_QUANTITY}. Current in cart: ${currentQty}`,
          400,
        )
      }
    } else {
      // Check product stock availability
      const existingCartItem = await db.cartItem.findFirst({
        where: { userId, productId, variantId: null },
      })
      const currentQty = existingCartItem ? existingCartItem.quantity : 0
      const totalQty = currentQty + quantity

      if (totalQty > product.stock) {
        return errorResponse(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, In cart: ${currentQty}, Requested additional: ${quantity}`,
          400,
        )
      }

      if (totalQty > MAX_QUANTITY) {
        return errorResponse(
          `Maximum quantity per item is ${MAX_QUANTITY}. Current in cart: ${currentQty}`,
          400,
        )
      }
    }

    // Upsert: find existing cart item with same userId+productId+variantId
    const existingItem = await db.cartItem.findFirst({
      where: {
        userId,
        productId,
        variantId: variantId || null,
      },
    })

    let cartItem
    if (existingItem) {
      // Increment quantity
      cartItem = await db.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
        include: cartItemInclude,
      })
    } else {
      cartItem = await db.cartItem.create({
        data: {
          userId,
          productId,
          variantId: variantId || null,
          quantity,
        },
        include: cartItemInclude,
      })
    }

    const parsedCartItem = parseCartItemFields(cartItem)

    return successResponse(
      serializeDecimal(parsedCartItem),
      existingItem ? 'Cart item quantity updated' : 'Item added to cart',
      existingItem ? 200 : 201,
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'Cart POST error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}

// PUT /api/cart - Update cart item (quantity, isChecked)
export async function PUT(request: NextRequest) {
  try {
    const guard = await apiGuard(request, { auth: 'user', schema: cartUpdateSchema })
    if (guard instanceof NextResponse) return guard

    const { cartItemId, quantity, isChecked } = guard.body!

    const userId = guard.user!.id

    // Find the existing cart item
    const existingItem = await db.cartItem.findUnique({
      where: { id: cartItemId },
    })

    if (!existingItem) {
      return errorResponse('Cart item not found', 404)
    }

    // SECURITY: Verify the cart item belongs to the authenticated user
    if (existingItem.userId !== userId) {
      return errorResponse('Forbidden - You can only update your own cart items', 403)
    }

    // Build update data
    const updateData: { quantity?: number; isChecked?: boolean } = {}

    if (quantity !== undefined) {
      // Validate stock availability
      if (existingItem.variantId) {
        const variant = await db.productVariant.findUnique({
          where: { id: existingItem.variantId },
          select: { stock: true, name: true },
        })

        if (variant && quantity > variant.stock) {
          return errorResponse(
            `Insufficient stock for variant "${variant.name}". Available: ${variant.stock}`,
            400,
          )
        }
      } else {
        const product = await db.product.findUnique({
          where: { id: existingItem.productId },
          select: { stock: true, name: true },
        })

        if (product && quantity > product.stock) {
          return errorResponse(
            `Insufficient stock for "${product.name}". Available: ${product.stock}`,
            400,
          )
        }
      }

      updateData.quantity = quantity
    }

    if (isChecked !== undefined) {
      updateData.isChecked = isChecked
    }

    // Update the cart item
    const updatedItem = await db.cartItem.update({
      where: { id: cartItemId },
      data: updateData,
      include: cartItemInclude,
    })

    const parsedCartItem = parseCartItemFields(updatedItem)

    return successResponse(serializeDecimal(parsedCartItem))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Cart PUT error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}

// DELETE /api/cart - Remove item(s) from cart
export async function DELETE(request: NextRequest) {
  try {
    const guard = await apiGuard(request, { auth: 'user', schema: cartDeleteSchema })
    if (guard instanceof NextResponse) return guard

    const { cartItemId } = guard.body!

    const userId = guard.user!.id

    // Support both single delete and batch delete
    const cartItemIds: string[] = Array.isArray(cartItemId) ? cartItemId : [cartItemId]

    // SECURITY: Verify all cart items belong to the authenticated user
    const itemsToDelete = await db.cartItem.findMany({
      where: {
        id: { in: cartItemIds },
      },
      select: { id: true, userId: true },
    })

    // Check for items not belonging to user
    const forbiddenItems = itemsToDelete.filter((item) => item.userId !== userId)
    if (forbiddenItems.length > 0) {
      return errorResponse('Forbidden - You can only remove items from your own cart', 403)
    }

    // Check for non-existent items
    const foundIds = new Set(itemsToDelete.map((item) => item.id))
    const notFoundIds = cartItemIds.filter((id) => !foundIds.has(id))
    if (notFoundIds.length > 0) {
      return errorResponse(`Cart item(s) not found: ${notFoundIds.join(', ')}`, 404)
    }

    // Delete the items
    const result = await db.cartItem.deleteMany({
      where: {
        id: { in: cartItemIds },
        userId, // Extra safety: ensure we only delete user's items
      },
    })

    const message = cartItemIds.length === 1
      ? 'Item removed from cart'
      : `${result.count} items removed from cart`

    return successResponse({ deletedCount: result.count }, message)
  } catch (error: unknown) {
    logger.error({ err: error }, 'Cart DELETE error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}
