import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiGuard } from '@/lib/api-guard'
import { wishlistAddSchema, wishlistDeleteSchema } from '@/lib/validations'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { parseProductJsonFields } from '@/lib/json-utils'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

// GET /api/wishlist - List user's wishlist items with product details
export async function GET(request: NextRequest) {
  try {
    const guard = await apiGuard(request, { auth: 'user', csrf: false })
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return errorResponse('userId is required', 400)
    }

    // SECURITY: Users can only access their own wishlist
    if (userId !== guard.user!.id) {
      return errorResponse('Forbidden - You can only access your own wishlist', 403)
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

    return successResponse(serializeDecimal(parsedWishlistItems))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Wishlist GET error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}

// POST /api/wishlist - Add item to wishlist
export async function POST(request: NextRequest) {
  try {
    const guard = await apiGuard(request, {
      auth: 'user',
      rateLimit: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:wishlist:' },
      schema: wishlistAddSchema,
    })
    if (guard instanceof NextResponse) return guard

    const { productId } = guard.body as { productId: string }
    const userId = guard.user!.id

    // Validate productId exists
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true },
    })

    if (!product) {
      return errorResponse('Product not found', 404)
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

    return successResponse(
      serializeDecimal(parsedWishlistItem),
      alreadyExisted ? 'Product already in wishlist' : 'Product added to wishlist',
      alreadyExisted ? 200 : 201,
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'Wishlist POST error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}

// DELETE /api/wishlist - Remove item from wishlist
export async function DELETE(request: NextRequest) {
  try {
    const guard = await apiGuard(request, {
      auth: 'user',
      rateLimit: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:wishlist:' },
      schema: wishlistDeleteSchema,
    })
    if (guard instanceof NextResponse) return guard

    const { productId, wishlistId } = guard.body as { productId?: string; wishlistId?: string }
    const userId = guard.user!.id

    if (wishlistId) {
      // Delete by wishlistId - must verify ownership first
      const existingItem = await db.wishlist.findUnique({
        where: { id: wishlistId },
      })

      if (!existingItem) {
        return errorResponse('Wishlist item not found', 404)
      }

      // SECURITY: Verify the wishlist item belongs to the authenticated user
      if (existingItem.userId !== userId) {
        return errorResponse('Forbidden - You can only remove items from your own wishlist', 403)
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
            productId: productId!,
          },
        },
      })

      if (!existingItem) {
        return errorResponse('Wishlist item not found', 404)
      }

      await db.wishlist.delete({
        where: {
          userId_productId: {
            userId,
            productId: productId!,
          },
        },
      })
    }

    return successResponse(null, 'Item removed from wishlist')
  } catch (error: unknown) {
    logger.error({ err: error }, 'Wishlist DELETE error')
    return errorResponse('Terjadi kesalahan server', 500)
  }
}
