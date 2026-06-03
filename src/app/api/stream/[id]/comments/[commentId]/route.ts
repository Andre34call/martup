import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// Rate limiters: 10 comment deletions per minute + burst protection
const commentDeleteLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'rl:stream-comment-delete:',
})
const commentDeleteBurstLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:stream-comment-delete-burst:' })

// ==================== DELETE /api/stream/[id]/comments/[commentId] ====================
// Delete a comment — only the comment author can delete their own comment
// Requires authentication + rate limiting
// Uses a transaction to delete the comment and adjust the post's commentCount
// Cascading deletes handle replies and likes automatically
export async function DELETE(
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

    // SECURITY: Rate limit comment deletions
    const rateLimitResult = await commentDeleteLimiter.check(authResult.user.id)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please slow down.' },
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

    // Additional burst protection using distributed rate limiter
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const burstRateLimit = await commentDeleteBurstLimiter.check(`${authResult.user.id}:${clientIp}`)
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
      select: { id: true, postId: true, userId: true, parentId: true },
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

    // SECURITY: The comment author OR the post owner can delete the comment
    // Post owners should be able to moderate their own posts' comments
    if (comment.userId !== authResult.user.id) {
      // Check if the user is the post owner
      const post = await db.streamPost.findUnique({
        where: { id: postId },
        select: { userId: true },
      })
      if (!post || post.userId !== authResult.user.id) {
        logger.warn(
          { userId: authResult.user.id, commentId, commentAuthorId: comment.userId, postId },
          'Unauthorized comment deletion attempt'
        )
        return NextResponse.json(
          { success: false, error: 'You can only delete your own comments or comments on your posts' },
          { status: 403 }
        )
      }
    }

    // Use a transaction to:
    // 1. Count all replies that will be cascade-deleted (for accurate commentCount adjustment)
    // 2. Delete the comment (cascading deletes handle replies + likes)
    // 3. Decrement the post's commentCount by the total deleted (1 comment + N replies)
    const deletedCount = await db.$transaction(async (tx) => {
      // Count direct replies of this comment
      // Note: Due to recursive onDelete:Cascade, deleting the parent comment
      // will also cascade-delete its replies and their nested replies.
      // We count only the direct replies here, but the cascade handles all levels.
      // For accurate total, we count the comment itself (1) + all descendant comments.
      const descendantCount = await tx.streamComment.count({
        where: { parentId: commentId },
      })

      // The total number of comments being removed:
      // 1 (the comment itself) + all its replies (cascade handles nested)
      // Note: For deeply nested structures, we'd need recursive counting,
      // but the schema only allows one level of nesting (enforced at POST),
      // so direct replies are the only descendants.
      const totalDeleted = 1 + descendantCount

      // Delete the comment — cascading deletes handle replies and likes
      await tx.streamComment.delete({
        where: { id: commentId },
      })

      // Decrement the post's commentCount by the total number of deleted comments
      await tx.streamPost.update({
        where: { id: postId },
        data: {
          commentCount: { decrement: totalDeleted },
        },
      })

      return totalDeleted
    })

    logger.info(
      {
        userId: authResult.user.id,
        postId,
        commentId,
        isReply: !!comment.parentId,
        totalDeleted: deletedCount,
      },
      'Stream comment deleted'
    )

    return NextResponse.json({
      success: true,
      data: {
        deletedCount,
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stream comment DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
