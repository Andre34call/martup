import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, ELEVATED_ROLES } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// ==================== GET /api/stream/[id] ====================
// Get single post with full details — public endpoint
// Increments viewCount by 1
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

    // Fetch the post and increment viewCount in one operation
    const post = await db.streamPost.update({
      where: { id, isActive: true },
      data: { viewCount: { increment: 1 } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
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

    // Format response
    const { _count, likes, ...postData } = post
    const formattedPost = {
      ...postData,
      likeCount: _count.likes,
      commentCount: _count.comments,
      isLiked: authedUserId ? (likes?.length ?? 0) > 0 : false,
    }

    return NextResponse.json({
      success: true,
      data: formattedPost,
    })
  } catch (error: unknown) {
    // Prisma throws P2025 when record not found in update
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }
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
