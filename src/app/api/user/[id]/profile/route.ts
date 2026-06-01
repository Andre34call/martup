import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { successResponse, errorResponse, notFoundResponse, withErrorHandler, type RouteContext } from '@/lib/api-utils'

// ==================== GET /api/user/[id]/profile ====================
// Fetch a user's public profile for the Stream feature.
// Public endpoint — no auth required.
// Returns: user info, seller info (if any), recent stream posts, recent products, and post stats.

export const GET = withErrorHandler(async (request: NextRequest, context?: RouteContext) => {
  if (!context) return errorResponse('Missing route context', 500)
  const { id } = await context.params

  // 1. Fetch user with select fields (email only if NOT hidden)
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      role: true,
      isVerified: true,
      createdAt: true,
      emailHidden: true,
      email: true,
    },
  })

  if (!user) {
    return notFoundResponse('User')
  }

  // Conditionally include email (only if NOT hidden)
  const { emailHidden, email, ...userRest } = user
  const userData = {
    ...userRest,
    ...(emailHidden ? {} : { email }),
  }

  // 2. Fetch seller record if they have one (include id for product lookup)
  const seller = await db.seller.findUnique({
    where: { userId: id },
    select: {
      id: true,
      storeName: true,
      storeSlug: true,
      storeAvatar: true,
      isVerified: true,
      rating: true,
      totalProducts: true,
      totalSales: true,
    },
  })

  // 3. Fetch user's recent stream posts (public only: isActive, !isHidden, !isPrivate)
  const postWhere = {
    userId: id,
    isActive: true,
    isHidden: false,
    isPrivate: false,
  }

  const posts = await db.streamPost.findMany({
    where: postWhere,
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      type: true,
      content: true,
      mediaUrl: true,
      thumbnailUrl: true,
      likeCount: true,
      commentCount: true,
      viewCount: true,
      isEdited: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          discountPrice: true,
          images: true,
        },
      },
    },
  })

  // Format posts — map product.images (JSON string) to product.image (first URL)
  const formattedPosts = posts.map((post) => {
    const { product: rawProduct, ...postData } = post

    let product: {
      id: string
      name: string
      slug: string
      price: unknown
      discountPrice: unknown
      image: string | undefined
    } | null = null

    if (rawProduct) {
      let image: string | undefined
      try {
        const parsed = JSON.parse(rawProduct.images as string)
        image = Array.isArray(parsed) ? parsed[0] : undefined
      } catch {
        image = undefined
      }
      product = {
        id: rawProduct.id,
        name: rawProduct.name,
        slug: rawProduct.slug,
        price: rawProduct.price,
        discountPrice: rawProduct.discountPrice,
        image,
      }
    }

    return {
      ...postData,
      product,
    }
  })

  // 4. Fetch user's products if they're a seller (limit 10, active only)
  let products: unknown[] = []

  if (seller) {
    const rawProducts = await db.product.findMany({
      where: {
        sellerId: seller.id,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        discountPrice: true,
        images: true,
        sold: true,
        rating: true,
      },
    })

    products = rawProducts.map((p) => {
      let image: string | undefined
      try {
        const parsed = JSON.parse(p.images as string)
        image = Array.isArray(parsed) ? parsed[0] : undefined
      } catch {
        image = undefined
      }

      const { images, ...rest } = p
      return {
        ...rest,
        image,
      }
    })
  }

  // 5. Aggregate stats: totalPosts and totalLikes
  const [totalPostsResult, totalLikesResult] = await Promise.all([
    db.streamPost.count({ where: postWhere }),
    db.streamPost.aggregate({
      where: postWhere,
      _sum: { likeCount: true },
    }),
  ])

  // Exclude seller.id from response (only needed internally for product lookup)
  const { id: _sellerId, ...sellerData } = seller ?? { id: '' }

  return successResponse({
    user: userData,
    seller: seller ? sellerData : null,
    posts: formattedPosts,
    products,
    stats: {
      totalPosts: totalPostsResult,
      totalLikes: totalLikesResult._sum.likeCount ?? 0,
    },
  })
})
