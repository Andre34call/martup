import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'

// Helper to safely parse JSON fields
function parseJsonField(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Helper to parse product JSON fields (images, tags stored as JSON strings)
function parseProductJsonFields(product: Record<string, unknown>) {
  return {
    ...product,
    images: parseJsonField(product.images as string | null | undefined),
    tags: parseJsonField(product.tags as string | null | undefined),
  }
}

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

const MAX_QUANTITY = 99

// GET /api/cart - List user's cart items with product details
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Users can only access their own cart
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only access your own cart' },
        { status: 403 }
      )
    }

    const cartItems = await db.cartItem.findMany({
      where: { userId },
      include: cartItemInclude,
      orderBy: { createdAt: 'desc' },
    })

    // Parse JSON fields in products
    const parsedCartItems = cartItems.map((item) => parseCartItemFields(item))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedCartItems,
    }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Cart GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/cart - Add item to cart (or merge/clear via query params)
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const { searchParams } = new URL(request.url)
    const merge = searchParams.get('merge') === 'true'
    const clear = searchParams.get('clear') === 'true'

    // POST /api/cart?clear=true - Clear all cart items for the user
    if (clear) {
      const userId = authResult.user.id

      await db.cartItem.deleteMany({
        where: { userId },
      })

      return NextResponse.json({
        success: true,
        message: 'Cart cleared successfully',
      })
    }

    // SECURITY: Rate limit cart operations
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`cart:${clientIp}:${authResult.user.id}`, 30)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const userId = authResult.user.id

    // POST /api/cart?merge=true - Merge localStorage cart into DB
    if (merge) {
      const { items } = body as { items: Array<{ productId: string; variantId?: string | null; quantity: number }> }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'items array is required for merge' },
          { status: 400 }
        )
      }

      const mergedItems = []

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

      return NextResponse.json(serializeDecimal({
        success: true,
        data: mergedItems,
        message: `Merged ${mergedItems.length} items into cart`,
      }))
    }

    // POST /api/cart - Add a single item to cart
    const { productId, variantId, quantity = 1 } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    if (quantity < 1) {
      return NextResponse.json(
        { success: false, error: 'Quantity must be at least 1' },
        { status: 400 }
      )
    }

    if (quantity > MAX_QUANTITY) {
      return NextResponse.json(
        { success: false, error: `Maximum quantity per item is ${MAX_QUANTITY}` },
        { status: 400 }
      )
    }

    // Validate product exists and is active
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true, stock: true, name: true },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    if (product.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Product is not available' },
        { status: 400 }
      )
    }

    // Validate variant if provided
    if (variantId) {
      const variant = await db.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, stock: true, name: true },
      })

      if (!variant) {
        return NextResponse.json(
          { success: false, error: 'Variant not found' },
          { status: 404 }
        )
      }

      if (variant.productId !== productId) {
        return NextResponse.json(
          { success: false, error: 'Variant does not belong to this product' },
          { status: 400 }
        )
      }

      // Check variant stock availability
      const existingCartItem = await db.cartItem.findFirst({
        where: { userId, productId, variantId },
      })
      const currentQty = existingCartItem ? existingCartItem.quantity : 0
      const totalQty = currentQty + quantity

      if (totalQty > variant.stock) {
        return NextResponse.json(
          { success: false, error: `Insufficient stock for variant "${variant.name}". Available: ${variant.stock}, In cart: ${currentQty}, Requested additional: ${quantity}` },
          { status: 400 }
        )
      }

      if (totalQty > MAX_QUANTITY) {
        return NextResponse.json(
          { success: false, error: `Maximum quantity per item is ${MAX_QUANTITY}. Current in cart: ${currentQty}` },
          { status: 400 }
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
        return NextResponse.json(
          { success: false, error: `Insufficient stock for "${product.name}". Available: ${product.stock}, In cart: ${currentQty}, Requested additional: ${quantity}` },
          { status: 400 }
        )
      }

      if (totalQty > MAX_QUANTITY) {
        return NextResponse.json(
          { success: false, error: `Maximum quantity per item is ${MAX_QUANTITY}. Current in cart: ${currentQty}` },
          { status: 400 }
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

    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: parsedCartItem,
        message: existingItem ? 'Cart item quantity updated' : 'Item added to cart',
      }),
      { status: existingItem ? 200 : 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Cart POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/cart - Update cart item (quantity, isChecked)
export async function PUT(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const body = await request.json()
    const { cartItemId, quantity, isChecked } = body

    if (!cartItemId) {
      return NextResponse.json(
        { success: false, error: 'cartItemId is required' },
        { status: 400 }
      )
    }

    if (quantity === undefined && isChecked === undefined) {
      return NextResponse.json(
        { success: false, error: 'At least one of quantity or isChecked must be provided' },
        { status: 400 }
      )
    }

    const userId = authResult.user.id

    // Find the existing cart item
    const existingItem = await db.cartItem.findUnique({
      where: { id: cartItemId },
    })

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: 'Cart item not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the cart item belongs to the authenticated user
    if (existingItem.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only update your own cart items' },
        { status: 403 }
      )
    }

    // Build update data
    const updateData: { quantity?: number; isChecked?: boolean } = {}

    if (quantity !== undefined) {
      if (quantity < 1) {
        return NextResponse.json(
          { success: false, error: 'Quantity must be at least 1' },
          { status: 400 }
        )
      }

      if (quantity > MAX_QUANTITY) {
        return NextResponse.json(
          { success: false, error: `Maximum quantity per item is ${MAX_QUANTITY}` },
          { status: 400 }
        )
      }

      // Validate stock availability
      if (existingItem.variantId) {
        const variant = await db.productVariant.findUnique({
          where: { id: existingItem.variantId },
          select: { stock: true, name: true },
        })

        if (variant && quantity > variant.stock) {
          return NextResponse.json(
            { success: false, error: `Insufficient stock for variant "${variant.name}". Available: ${variant.stock}` },
            { status: 400 }
          )
        }
      } else {
        const product = await db.product.findUnique({
          where: { id: existingItem.productId },
          select: { stock: true, name: true },
        })

        if (product && quantity > product.stock) {
          return NextResponse.json(
            { success: false, error: `Insufficient stock for "${product.name}". Available: ${product.stock}` },
            { status: 400 }
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

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedCartItem,
    }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Cart PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// DELETE /api/cart - Remove item(s) from cart
export async function DELETE(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const body = await request.json()
    const { cartItemId } = body

    if (!cartItemId) {
      return NextResponse.json(
        { success: false, error: 'cartItemId is required' },
        { status: 400 }
      )
    }

    const userId = authResult.user.id

    // Support both single delete and batch delete
    const cartItemIds: string[] = Array.isArray(cartItemId) ? cartItemId : [cartItemId]

    if (cartItemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one cartItemId is required' },
        { status: 400 }
      )
    }

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
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only remove items from your own cart' },
        { status: 403 }
      )
    }

    // Check for non-existent items
    const foundIds = new Set(itemsToDelete.map((item) => item.id))
    const notFoundIds = cartItemIds.filter((id) => !foundIds.has(id))
    if (notFoundIds.length > 0) {
      return NextResponse.json(
        { success: false, error: `Cart item(s) not found: ${notFoundIds.join(', ')}` },
        { status: 404 }
      )
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

    return NextResponse.json({
      success: true,
      message,
      data: { deletedCount: result.count },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Cart DELETE error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
