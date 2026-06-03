import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// Rate limiters: 30 like toggles per minute + 10 burst protection
const likeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'rl:stream-like:',
})
const likeBurstLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:stream-like-burst:' })

// ==================== POST /api/stream/[id]/like ====================
// Toggle like — like if not liked, unlike if already liked
// Uses interactive transaction with authoritative count to prevent race conditions
// Requires authentication + rate limiting
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

    // SECURITY: Rate limit like toggles to prevent spam
    const rateLimitResult = await likeLimiter.check(authResult.user.id)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    // Additional burst protection
    const burstRateLimit = await likeBurstLimiter.check(authResult.user.id)
    if (!burstRateLimit.allowed) {
      const retrySeconds = Math.ceil((burstRateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    // Verify the post exists and is active
    const post = await db.streamPost.findUnique({
      where: { id: postId, isActive: true },
      select: { id: true },
    })

    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      )
    }

    // Use interactive transaction with authoritative count
    // This prevents race conditions where concurrent toggles could cause likeCount drift
    let isLiked: boolean

    await db.$transaction(async (tx) => {
      // Check if user already liked this post (inside transaction for consistency)
      const existingLike = await tx.streamLike.findUnique({
        where: {
          postId_userId: {
            postId,
            userId: authResult.user.id,
          },
        },
      })

      if (existingLike) {
        // Unlike: remove the like
        await tx.streamLike.delete({
          where: { id: existingLike.id },
        })
        isLiked = false
      } else {
        // Like: create the like
        await tx.streamLike.create({
          data: {
            postId,
            userId: authResult.user.id,
          },
        })
        isLiked = true
      }

      // After mutation, query the ACTUAL count from the likes table (authoritative)
      // This makes the likeCount consistent regardless of concurrent operations
      const actualCount = await tx.streamLike.count({
        where: { postId },
      })

      // Update likeCount to match the authoritative count
      await tx.streamPost.update({
        where: { id: postId },
        data: { likeCount: actualCount },
      })
    })

    logger.info(
      { userId: authResult.user.id, postId, action: isLiked! ? 'like' : 'unlike' },
      'Stream post like toggled'
    )

    // Fetch the final authoritative likeCount
    const updatedPost = await db.streamPost.findUnique({
      where: { id: postId },
      select: { likeCount: true },
    })

    return NextResponse.json({
      success: true,
      isLiked: isLiked!,
      likeCount: updatedPost?.likeCount ?? 0,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stream like toggle error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
