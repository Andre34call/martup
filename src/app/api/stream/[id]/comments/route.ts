import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { sanitizeInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

// ==================== GET /api/stream/[id]/comments ====================
// Fetch comments for a post — public endpoint
// Includes user info and limited replies per comment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limitParam = searchParams.get('limit')

    // Parse and clamp limit
    let limit = parseInt(limitParam || '20', 10)
    if (isNaN(limit) || limit < 1) limit = 20
    if (limit > 50) limit = 50

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

    // Build where clause for top-level comments only (parentId = null)
    const where: Record<string, unknown> = {
      postId,
      parentId: null,
    }
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) }
    }

    // Fetch top-level comments
    const comments = await db.streamComment.findMany({
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
        replies: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    })

    // Determine if there's a next page
    const hasMore = comments.length > limit
    const items = hasMore ? comments.slice(0, limit) : comments

    // Format comments — include reply count and limited replies
    const formattedComments = items.map((comment) => {
      const { _count, replies, ...commentData } = comment
      return {
        ...commentData,
        replyCount: _count.replies,
        replies: replies.map((reply) => {
          // Replies don't need nested replies in the list view
          const { ...replyData } = reply
          return replyData
        }),
      }
    })

    // Next cursor = last item's createdAt
    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1].createdAt.toISOString()
      : null

    return NextResponse.json({
      success: true,
      data: formattedComments,
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stream comments GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== POST /api/stream/[id]/comments ====================
// Add a comment or reply — requires authentication
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

    // SECURITY: Rate limit comment creation
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(`stream-comment:${authResult.user.id}:${clientIp}`, 20)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please slow down.' },
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

    const body = await request.json()
    const { parentId } = body

    // Sanitize and validate content
    const content = sanitizeInput(body.content || '')
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Comment content is required' },
        { status: 400 }
      )
    }
    if (content.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Comment must be at most 500 characters' },
        { status: 400 }
      )
    }

    // If parentId is provided, validate it's a reply to a comment on the same post
    if (parentId) {
      const parentComment = await db.streamComment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true, parentId: true },
      })

      if (!parentComment) {
        return NextResponse.json(
          { success: false, error: 'Parent comment not found' },
          { status: 404 }
        )
      }

      if (parentComment.postId !== postId) {
        return NextResponse.json(
          { success: false, error: 'Parent comment does not belong to this post' },
          { status: 400 }
        )
      }

      // Only allow one level of nesting — replies must be to top-level comments
      if (parentComment.parentId) {
        return NextResponse.json(
          { success: false, error: 'Cannot reply to a reply. Only one level of nesting is allowed.' },
          { status: 400 }
        )
      }
    }

    // Create comment and increment commentCount in a transaction
    const comment = await db.$transaction(async (tx) => {
      const newComment = await tx.streamComment.create({
        data: {
          postId,
          userId: authResult.user.id,
          parentId: parentId || null,
          content,
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

      // Increment commentCount on the post
      await tx.streamPost.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      })

      return newComment
    })

    logger.info(
      { userId: authResult.user.id, postId, commentId: comment.id, isReply: !!parentId },
      'Stream comment created'
    )

    return NextResponse.json(
      {
        success: true,
        data: comment,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'Stream comments POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
