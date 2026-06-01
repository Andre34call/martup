import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, ELEVATED_ROLES } from '@/lib/auth-middleware'
import { checkRateLimit } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// ==================== GET /api/stream/[id] ====================
// Get single post with full details — public endpoint
// Increments viewCount with rate limiting (once per IP per hour)
// Includes product relation and isHidden filter
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Fetch the post with product relation included
    // Filter out hidden posts (isHidden: true)
    const post = await db.streamPost.findUnique({
      where: { id, isActive: true, isHidden: false },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
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

    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    // Rate-limited view count increment: once per IP per hour
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const viewKey = `stream-view:${id}:${clientIp}`
    if (checkRateLimit(viewKey, 1)) {
      // Only increment if not rate-limited (first view from this IP in the current window)
      await db.streamPost.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }).catch((err: unknown) => {
        // Log but don't fail the request if viewCount increment fails
        logger.warn({ err, postId: id }, 'Failed to increment viewCount')
      })
    }

    // Format response — include product data like the feed endpoint
    const { _count, likes, product: rawProduct, ...postData } = post
    let product: { id: string; name: string; slug: string; price: unknown; discountPrice: unknown; image: string | undefined } | null = null
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

    const formattedPost = {
      ...postData,
      product,
      likeCount: _count.likes,
      commentCount: _count.comments,
      isLiked: authedUserId ? (likes?.length ?? 0) > 0 : false,
    }

    return NextResponse.json({
      success: true,
      data: formattedPost,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stream GET single post error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== DELETE /api/stream/[id] ====================
// Soft delete a post — requires auth
// Only the post owner or an admin can delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Find the post
    const post = await db.streamPost.findUnique({
      where: { id },
      select: { id: true, userId: true, isActive: true },
    })

    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    if (!post.isActive) {
      return NextResponse.json(
        { success: false, error: 'Post already deleted' },
        { status: 410 }
      )
    }

    // SECURITY: Only the post owner or an admin can delete
    const isOwner = post.userId === authResult.user.id
    const isAdmin = (ELEVATED_ROLES as readonly string[]).includes(authResult.user.role)
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own posts' },
        { status: 403 }
      )
    }

    // Soft delete: set isActive = false
    await db.streamPost.update({
      where: { id },
      data: { isActive: false },
    })

    logger.info(
      { postId: id, deletedBy: authResult.user.id, wasOwner: isOwner },
      'Stream post soft-deleted'
    )

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stream DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
