import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'

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

// Helper to parse product JSON fields
function parseProductJsonFields(product: Record<string, unknown>) {
  return {
    ...product,
    images: parseJsonField(product.images as string | null | undefined),
    tags: parseJsonField(product.tags as string | null | undefined),
  }
}

// GET /api/user-data - Fetch ALL user-specific data in one call
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Users can only fetch their own data
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only access your own data' },
        { status: 403 }
      )
    }

    // Fetch all user data in parallel
    const [
      user,
      seller,
      wallet,
      orders,
      notifications,
      addresses,
      reviews,
      wishlists,
    ] = await Promise.all([
      // User profile
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          avatar: true,
          role: true,
          isVerified: true,
          isActive: true,
          loyaltyPoints: true,
          coins: true,
          referralCode: true,
          dailyCheckIn: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      // Seller profile (if exists)
      db.seller.findUnique({
        where: { userId },
        include: {
          wallet: true,
        },
      }),

      // Wallet with recent mutations
      db.wallet.findUnique({
        where: { userId },
        include: {
          mutations: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      }),

      // Orders with items, shipping, seller info
      db.order.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                  slug: true,
                  price: true,
                },
              },
              variant: true,
            },
          },
          shipping: true,
          seller: {
            select: {
              id: true,
              userId: true,
              storeName: true,
              storeSlug: true,
              storeAvatar: true,
              isVerified: true,
              isPremium: true,
              rating: true,
              totalSales: true,
              totalProducts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Notifications
      db.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),

      // Addresses
      db.address.findMany({
        where: { userId },
        orderBy: { isDefault: 'desc' },
      }),

      // Reviews
      db.review.findMany({
        where: { userId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Wishlist product IDs
      db.wishlist.findMany({
        where: { userId },
        select: { productId: true },
      }),
    ])

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields in order items (product images)
    const parsedOrders = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        product: item.product
          ? parseProductJsonFields(item.product as unknown as Record<string, unknown>) as unknown as typeof item.product
          : item.product,
      })),
    }))

    // Parse JSON fields in reviews (product images)
    const parsedReviews = reviews.map((review) => ({
      ...review,
      images: parseJsonField(review.images),
      product: review.product
        ? parseProductJsonFields(review.product as unknown as Record<string, unknown>) as unknown as typeof review.product
        : review.product,
    }))

    // Extract wishlist product IDs
    const wishlistProductIds = wishlists.map((w) => w.productId)

    // Count unread notifications
    const unreadNotificationCount = notifications.filter((n) => !n.isRead).length

    return NextResponse.json({
      success: true,
      data: {
        user,
        seller,
        wallet,
        orders: parsedOrders,
        notifications,
        unreadNotificationCount,
        addresses,
        reviews: parsedReviews,
        wishlistProductIds,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('User Data GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
