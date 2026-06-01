import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit, ELEVATED_ROLES } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { sanitizeInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

// ==================== RATE LIMITERS ====================

const postLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
  keyPrefix: 'rl:stream-post:',
})

// ==================== HELPERS ====================

const VALID_POST_TYPES = ['text', 'video', 'image'] as const
type PostType = (typeof VALID_POST_TYPES)[number]

function isValidPostType(value: string): value is PostType {
  return VALID_POST_TYPES.includes(value as PostType)
}

// ==================== GET /api/stream ====================
// Fetch stream feed — public endpoint (no auth required)
// Supports cursor-based pagination and optional userId filter
// Filters out hidden posts (isHidden: true)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limitParam = searchParams.get('limit')
    const userId = searchParams.get('userId')
    const searchQuery = searchParams.get('search')

    // Parse and clamp limit
    let limit = parseInt(limitParam || '10', 10)
    if (isNaN(limit) || limit < 1) limit = 10
    if (limit > 20) limit = 20

    // Optionally check auth for isLiked — but don't require it
    let authedUserId: string | null = null
    try {
      const authResult = await verifyAuth(request)
      if (authResult.success) {
        authedUserId = authResult.user.id
      }
    } catch {
      // Auth check is optional for GET — continue without auth
    }

    // Build where clause — filter out hidden and inactive posts
    const where: Record<string, unknown> = { isActive: true, isHidden: false }
    if (userId) {
      where.userId = userId
    }
    if (searchQuery && searchQuery.trim().length >= 2) {
      // Search in post content and user name
      where.OR = [
        { content: { contains: searchQuery.trim(), mode: 'insensitive' } },
        { user: { name: { contains: searchQuery.trim(), mode: 'insensitive' } } },
      ]
    }
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) }
    }

    const posts = await db.streamPost.findMany({
      where,
      take: limit + 1, // +1 to detect if there's a next page
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
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
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        ...(authedUserId
          ? {
              likes: {
                where: { userId: authedUserId },
                select: { id: true },
              },
            }
          : {}),
      },
    })

    // Determine if there's a next page
    const hasMore = posts.length > limit
    const items = hasMore ? posts.slice(0, limit) : posts

    // Format response — use `any` to avoid Prisma include/select type inference issues
    const formattedPosts = items.map((post: any) => {
      const { _count, likes, product: rawProduct, ...postData } = post
      // Map product.images (JSON string) to product.image (first URL)
      let product: { id: string; name: string; slug: string; price: any; discountPrice: any; image: string | undefined } | null = null
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
        likeCount: _count?.likes ?? 0,
        commentCount: _count?.comments ?? 0,
        isLiked: authedUserId ? (likes?.length ?? 0) > 0 : false,
      }
    })

    // Next cursor = last item's createdAt
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].createdAt.toISOString()
      : null

    return NextResponse.json({
      success: true,
      data: formattedPosts,
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stream GET feed error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== POST /api/stream ====================
// Create a new stream post — requires authentication
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit — 10 posts per hour per user
    const rateLimitResult = await postLimiter.check(authResult.user.id)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Maximum 10 posts per hour.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.total),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetAt / 1000)),
          },
        }
      )
    }

    // Additional per-minute rate limit for burst protection
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(`stream-post-min:${authResult.user.id}:${clientIp}`, 5)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please slow down.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { type, mediaUrl, mediaType, thumbnailUrl, productId } = body

    // Validate type
    if (!type || !isValidPostType(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be one of: text, video, image' },
        { status: 400 }
      )
    }

    // Sanitize and validate content — content is optional if media is provided
    // Store null instead of empty string for media-only posts
    const rawContent = body.content ? String(body.content) : ''
    const content = sanitizeInput(rawContent) || null
    if (!content && !mediaUrl) {
      return NextResponse.json(
        { success: false, error: 'Content or media is required' },
        { status: 400 }
      )
    }
    if (content && content.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Content must be at most 2000 characters' },
        { status: 400 }
      )
    }

    // If type is video or image, mediaUrl is required
    if ((type === 'video' || type === 'image') && !mediaUrl) {
      return NextResponse.json(
        { success: false, error: `mediaUrl is required for ${type} posts` },
        { status: 400 }
      )
    }

    // If productId is provided, verify it exists
    if (productId) {
      const product = await db.product.findUnique({ where: { id: productId } })
      if (!product) {
        return NextResponse.json(
          { success: false, error: 'Referenced product not found' },
          { status: 404 }
        )
      }
    }

    // Create the post
    const post = await db.streamPost.create({
      data: {
        userId: authResult.user.id,
        type,
        content,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        thumbnailUrl: thumbnailUrl || null,
        productId: productId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    logger.info(
      { userId: authResult.user.id, postId: post.id, type },
      'Stream post created'
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          ...post,
          likeCount: 0,
          commentCount: 0,
          isLiked: false,
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    // Log full error for debugging
    logger.error({ err: error }, 'Stream POST create error')
    
    // Return specific error message for validation errors, generic for everything else
    const isDev = process.env.NODE_ENV === 'development'
    const errorMessage = error instanceof Error && isDev
      ? `Server error: ${error.message}`
      : 'Terjadi kesalahan server'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
