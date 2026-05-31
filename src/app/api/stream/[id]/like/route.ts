import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// ==================== POST /api/stream/[id]/like ====================
// Toggle like — like if not liked, unlike if already liked
// Requires authentication
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params

    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Verify the post exists and is active
    const post = await db.streamPost.findUnique({
      where: { id: postId, isActive: true },
      select: { id: true, likeCount: true },
    })

    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    // Check if user already liked this post
    const existingLike = await db.streamLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: authResult.user.id,
        },
      },
    })

    let isLiked: boolean

    if (existingLike) {
      // Unlike: remove the like and decrement likeCount
      await db.$transaction([
        db.streamLike.delete({
          where: { id: existingLike.id },
        }),
        db.streamPost.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        }),
      ])
      isLiked = false

      logger.info(
        { userId: authResult.user.id, postId, action: 'unlike' },
        'Stream post unliked'
      )
    } else {
      // Like: create the like and increment likeCount
      await db.$transaction([
        db.streamLike.create({
          data: {
            postId,
            userId: authResult.user.id,
          },
        }),
        db.streamPost.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        }),
      ])
      isLiked = true

      logger.info(
        { userId: authResult.user.id, postId, action: 'like' },
        'Stream post liked'
      )
    }

    // Fetch the updated likeCount
    const updatedPost = await db.streamPost.findUnique({
      where: { id: postId },
      select: { likeCount: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        postId,
        isLiked,
        likeCount: updatedPost?.likeCount ?? 0,
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stream like toggle error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
