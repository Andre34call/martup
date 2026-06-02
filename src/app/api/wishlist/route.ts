import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { parseJsonField } from '@/lib/api-utils'
import { serializeDecimal } from '@/lib/decimal-utils'

import { logger } from '@/lib/logger'
// Helper to parse product JSON fields (images, tags stored as JSON strings)
function parseProductJsonFields(product: Record<string, unknown>) {
  return {
    ...product,
    images: parseJsonField(product.images as string | null | undefined),
    tags: parseJsonField(product.tags as string | null | undefined),
  }
}

// GET /api/wishlist - List user's wishlist items with product details
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

    // SECURITY: Users can only access their own wishlist
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only access your own wishlist' },
        { status: 403 }
      )
    }

    const wishlistItems = await db.wishlist.findMany({
      where: { userId },
      include: {
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
      },
      orderBy: { createdAt: 'desc' },
    })

    // Parse JSON fields in product (images, tags stored as JSON strings)
    const parsedWishlistItems = wishlistItems.map((item) => ({
      ...item,
      product: item.product
        ? (parseProductJsonFields(item.product as unknown as Record<string, unknown>) as unknown as typeof item.product)
        : item.product,
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedWishlistItems,
    }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Wishlist GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/wishlist - Add item to wishlist
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit wishlist operations
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`wishlist:${clientIp}:${authResult.user.id}`, 30)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { productId } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    const userId = authResult.user.id

    // Validate productId exists
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Use upsert to handle @@unique([userId, productId]) constraint
    // If already exists, return existing record (idempotent)
    const wishlistItem = await db.wishlist.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      update: {}, // No-op if exists - keeps existing record as-is
      create: {
        userId,
        productId,
      },
      include: {
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
      },
    })

    // Parse JSON fields in product
    const parsedWishlistItem = {
      ...wishlistItem,
      product: wishlistItem.product
        ? (parseProductJsonFields(wishlistItem.product as unknown as Record<string, unknown>) as unknown as typeof wishlistItem.product)
        : wishlistItem.product,
    }

    // Check if it was created (new) or already existed (idempotent)
    const alreadyExisted = wishlistItem.createdAt.getTime() < Date.now() - 1000

    return NextResponse.json(
      serializeDecimal({
        success: true,
        data: parsedWishlistItem,
        message: alreadyExisted ? 'Product already in wishlist' : 'Product added to wishlist',
      }),
      { status: alreadyExisted ? 200 : 201 }
    )
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Wishlist POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/wishlist - Remove item from wishlist
export async function DELETE(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit wishlist operations
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`wishlist:${clientIp}:${authResult.user.id}`, 30)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { productId, wishlistId } = body

    if (!productId && !wishlistId) {
      return NextResponse.json(
        { success: false, error: 'productId or wishlistId is required' },
        { status: 400 }
      )
    }

    const userId = authResult.user.id

    if (wishlistId) {
      // Delete by wishlistId - must verify ownership first
      const existingItem = await db.wishlist.findUnique({
        where: { id: wishlistId },
      })

      if (!existingItem) {
        return NextResponse.json(
          { success: false, error: 'Wishlist item not found' },
          { status: 404 }
        )
      }

      // SECURITY: Verify the wishlist item belongs to the authenticated user
      if (existingItem.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden - You can only remove items from your own wishlist' },
          { status: 403 }
        )
      }

      await db.wishlist.delete({
        where: { id: wishlistId },
      })
    } else {
      // Delete by userId + productId composite
      const existingItem = await db.wishlist.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      })

      if (!existingItem) {
        return NextResponse.json(
          { success: false, error: 'Wishlist item not found' },
          { status: 404 }
        )
      }

      await db.wishlist.delete({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Item removed from wishlist',
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Wishlist DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
