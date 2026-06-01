import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, ELEVATED_ROLES } from '@/lib/auth-middleware'
import { checkRateLimit } from '@/lib/auth-middleware'
import { sanitizeInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

// ==================== GET /api/stream/[id] ====================
// Get single post with full details — public endpoint (unless private)
// Increments viewCount with rate limiting (once per IP per hour)
// Private posts are only visible to the owner
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Optionally check auth for isLiked and private access
    let authedUserId: string | null = null
    try {
      const authResult = await verifyAuth(request)
      if (authResult.success) {
        authedUserId = authResult.user.id
      }
    } catch {
      // Auth check is optional for GET — continue without auth
    }

    // Fetch the post — allow private posts only for the owner
    const whereClause: Record<string, unknown> = { id, isActive: true, isHidden: false }
    // If not the owner, filter out private posts
    if (!authedUserId) {
      whereClause.isPrivate = false
    }

    const post = await db.streamPost.findFirst({
      where: whereClause,
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

    // Private post access check: only owner can see
    if (post.isPrivate && post.userId !== authedUserId) {
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
      await db.streamPost.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }).catch((err: unknown) => {
        logger.warn({ err, postId: id }, 'Failed to increment viewCount')
      })
    }

    // Format response
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

// ==================== PUT /api/stream/[id] ====================
// Edit a post — requires auth (owner only)
// Can update: content, media (image/video), product link, private status
export async function PUT(
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
      where: { id, isActive: true },
      select: { id: true, userId: true, type: true, mediaUrl: true, isEdited: true },
    })

    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    // SECURITY: Only the post owner can edit
    if (post.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Kamu hanya bisa mengedit postingan sendiri' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { content, mediaUrl, mediaType, thumbnailUrl, productId, isPrivate } = body

    // Build update data — only include fields that are provided
    const updateData: Record<string, unknown> = { isEdited: true }

    // Update content if provided
    if (content !== undefined) {
      const sanitizedContent = sanitizeInput(String(content)) || null
      // Validate: must have content or media
      if (!sanitizedContent && !mediaUrl && !post.mediaUrl) {
        return NextResponse.json(
          { success: false, error: 'Content atau media harus diisi' },
          { status: 400 }
        )
      }
      if (sanitizedContent && sanitizedContent.length > 2000) {
        return NextResponse.json(
          { success: false, error: 'Konten maksimal 2000 karakter' },
          { status: 400 }
        )
      }
      updateData.content = sanitizedContent
    }

    // Update media if provided (null = remove media)
    if (mediaUrl !== undefined) {
      updateData.mediaUrl = mediaUrl || null
      updateData.mediaType = mediaType || null
      updateData.thumbnailUrl = thumbnailUrl || null

      // Update post type based on media
      if (mediaUrl) {
        if (mediaType?.startsWith('video/')) {
          updateData.type = 'video'
        } else if (mediaType?.startsWith('image/')) {
          updateData.type = 'image'
        }
      } else if (content !== undefined && !sanitizeInput(String(content))) {
        // Removing media with no content — not allowed
        return NextResponse.json(
          { success: false, error: 'Postingan harus punya konten atau media' },
          { status: 400 }
        )
      } else if (!mediaUrl && !post.mediaUrl) {
        // No media and not adding any — keep current type or set to text
        // Only change to text if there's content
        if (content !== undefined && sanitizeInput(String(content))) {
          updateData.type = 'text'
        }
      }
    }

    // Update product link if provided (null = remove link)
    if (productId !== undefined) {
      if (productId) {
        const product = await db.product.findUnique({ where: { id: productId } })
        if (!product) {
          return NextResponse.json(
            { success: false, error: 'Produk tidak ditemukan' },
            { status: 404 }
          )
        }
      }
      updateData.productId = productId || null
    }

    // Update private status if provided
    if (isPrivate !== undefined) {
      updateData.isPrivate = Boolean(isPrivate)
    }

    // Perform the update
    const updatedPost = await db.streamPost.update({
      where: { id },
      data: updateData,
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
        likes: {
          where: { userId: authResult.user.id },
          select: { id: true },
        },
      },
    })

    // Format response
    const { _count, likes, product: rawProduct, ...postData } = updatedPost
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

    logger.info(
      { postId: id, userId: authResult.user.id, updatedFields: Object.keys(updateData) },
      'Stream post updated'
    )

    return NextResponse.json({
      success: true,
      data: {
        ...postData,
        product,
        likeCount: _count.likes,
        commentCount: _count.comments,
        isLiked: (likes?.length ?? 0) > 0,
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stream PUT edit error')
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
