import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// Rate limiters: 30 comment like toggles per minute + burst protection
const commentLikeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'rl:stream-comment-like:',
})
const commentLikeBurstLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:stream-comment-like-burst:' })

// ==================== POST /api/stream/[id]/comments/[commentId]/like ====================
// Toggle like on a comment — like if not liked, unlike if already liked
// Requires authentication + rate limiting
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: postId, commentId } = await params

    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit like toggles
    const rateLimitResult = await commentLikeLimiter.check(authResult.user.id)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    // Additional burst protection
    const burstRateLimit = await commentLikeBurstLimiter.check(authResult.user.id)
    if (!burstRateLimit.allowed) {
      const retrySeconds = Math.ceil((burstRateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    // Verify the comment exists and belongs to the post
    const comment = await db.streamComment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true },
    })

    if (!comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      )
    }

    if (comment.postId !== postId) {
      return NextResponse.json(
        { success: false, error: 'Comment does not belong to this post' },
        { status: 400 }
      )
    }

    // Check if user already liked this comment
    const existingLike = await db.streamCommentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId: authResult.user.id,
        },
      },
    })

    let isLiked: boolean

    // Use interactive transaction with authoritative count to avoid race conditions
    await db.$transaction(async (tx) => {
      if (existingLike) {
        // Unlike: remove the like
        await tx.streamCommentLike.delete({
          where: { id: existingLike.id },
        })
        isLiked = false
      } else {
        // Like: create the like
        await tx.streamCommentLike.create({
          data: {
            commentId,
            userId: authResult.user.id,
          },
        })
        isLiked = true
      }

      // After mutation, query the ACTUAL count from the likes table (authoritative)
      const actualCount = await tx.streamCommentLike.count({
        where: { commentId },
      })

      // Update likeCount to match the authoritative count
      await tx.streamComment.update({
        where: { id: commentId },
        data: { likeCount: actualCount },
      })
    })

    logger.info(
      { userId: authResult.user.id, postId, commentId, action: isLiked! ? 'like' : 'unlike' },
      'Stream comment like toggled'
    )

    // Fetch the final authoritative likeCount
    const updatedComment = await db.streamComment.findUnique({
      where: { id: commentId },
      select: { likeCount: true },
    })

    return NextResponse.json({
      success: true,
      isLiked: isLiked!,
      likeCount: updatedComment?.likeCount ?? 0,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stream comment like toggle error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
