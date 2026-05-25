import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'

const MAX_QUANTITY = 99

// POST /api/cart/add - Add item to cart (SECURED with verifyAuth)
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication — NO more x-user-id spoofing
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const userId = authResult.user.id

    // Rate limit: 30 cart operations per minute per user
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`cart-add:${clientIp}:${userId}`, 30)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { productId, variantId, quantity } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'ProductId wajib diisi' },
        { status: 400 }
      )
    }

    const qty = Math.min(quantity || 1, MAX_QUANTITY)
    if (qty < 1) {
      return NextResponse.json(
        { success: false, error: 'Quantity minimal 1' },
        { status: 400 }
      )
    }

    // Check product exists and is active
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true, stock: true, name: true },
    })

    if (!product || product.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Produk tidak tersedia' },
        { status: 404 }
      )
    }

    // Check stock — consider existing cart quantity
    if (variantId) {
      const variant = await db.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, stock: true, name: true },
      })
      if (!variant) {
        return NextResponse.json(
          { success: false, error: 'Varian tidak ditemukan' },
          { status: 404 }
        )
      }
      if (variant.productId !== productId) {
        return NextResponse.json(
          { success: false, error: 'Varian tidak sesuai produk' },
          { status: 400 }
        )
      }

      // Check total quantity including what's already in cart
      const existingItem = await db.cartItem.findFirst({
        where: { userId, productId, variantId },
      })
      const currentQty = existingItem ? existingItem.quantity : 0
      const totalQty = currentQty + qty

      if (totalQty > variant.stock) {
        return NextResponse.json(
          { success: false, error: `Stok varian tidak mencukupi. Tersedia: ${variant.stock}, Di keranjang: ${currentQty}` },
          { status: 400 }
        )
      }
      if (totalQty > MAX_QUANTITY) {
        return NextResponse.json(
          { success: false, error: `Maksimal ${MAX_QUANTITY} per item. Di keranjang: ${currentQty}` },
          { status: 400 }
        )
      }
    } else {
      const existingItem = await db.cartItem.findFirst({
        where: { userId, productId, variantId: null },
      })
      const currentQty = existingItem ? existingItem.quantity : 0
      const totalQty = currentQty + qty

      if (totalQty > product.stock) {
        return NextResponse.json(
          { success: false, error: `Stok tidak mencukupi. Tersedia: ${product.stock}, Di keranjang: ${currentQty}` },
          { status: 400 }
        )
      }
      if (totalQty > MAX_QUANTITY) {
        return NextResponse.json(
          { success: false, error: `Maksimal ${MAX_QUANTITY} per item. Di keranjang: ${currentQty}` },
          { status: 400 }
        )
      }
    }

    // Check if item already exists in cart — upsert
    const existingItem = await db.cartItem.findFirst({
      where: {
        userId,
        productId,
        variantId: variantId || null,
      },
    })

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
          variants: true,
        },
      },
      variant: true,
    }

    if (existingItem) {
      // Increase quantity, capped at MAX_QUANTITY
      const newQty = Math.min(existingItem.quantity + qty, MAX_QUANTITY)
      const updatedItem = await db.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
        include: cartItemInclude,
      })

      // Parse JSON fields safely
      const responseItem = {
        ...updatedItem,
        product: updatedItem.product
          ? {
              ...updatedItem.product,
              images: safeJsonParse(updatedItem.product.images as unknown as string),
            }
          : null,
      }

      return NextResponse.json(serializeDecimal({
        success: true,
        data: responseItem,
        message: 'Jumlah produk diperbarui',
      }))
    }

    // Create new cart item
    const cartItem = await db.cartItem.create({
      data: {
        userId,
        productId,
        variantId: variantId || null,
        quantity: qty,
        isChecked: true,
      },
      include: cartItemInclude,
    })

    const responseItem = {
      ...cartItem,
      product: cartItem.product
        ? {
            ...cartItem.product,
            images: safeJsonParse(cartItem.product.images as unknown as string),
          }
        : null,
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: responseItem,
      message: 'Produk ditambahkan ke keranjang',
    }), { status: 201 })
  } catch (error) {
    console.error('Cart add error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

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
