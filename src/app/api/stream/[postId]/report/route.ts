import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, successResponse, errorResponse, parseRequestBody, withErrorHandler, type RouteContext } from '@/lib/api-utils'

const VALID_REASONS = ['spam', 'harassment', 'inappropriate_content', 'scam', 'other'] as const

type ReportReason = (typeof VALID_REASONS)[number]

interface ReportBody {
  reason: string
  description?: string
}

export const POST = withErrorHandler(async (request: NextRequest, context?: RouteContext) => {
  // 1. Require authentication
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  // 2. Get postId from context params
  if (!context) return errorResponse('Missing route context', 500)
  const { postId } = await context.params

  // 3. Parse request body
  const body = await parseRequestBody<ReportBody>(request)
  if (body instanceof NextResponse) return body

  const { reason, description } = body

  // 4. Validate reason
  if (!reason || !VALID_REASONS.includes(reason as ReportReason)) {
    return errorResponse(
      'Invalid report reason. Must be one of: ' + VALID_REASONS.join(', '),
      422,
    )
  }

  // 5. Check the post exists and is active
  const post = await db.streamPost.findUnique({
    where: { id: postId, isActive: true },
    select: { id: true, isHidden: true },
  })

  if (!post) {
    return errorResponse('Post not found', 404)
  }

  // 6. Check user hasn't already reported this post
  const existingReport = await db.streamPostReport.findUnique({
    where: {
      postId_userId: {
        postId,
        userId: auth.userId,
      },
    },
  })

  if (existingReport) {
    return errorResponse('You have already reported this post', 409)
  }

  // 7. Create the report and check if auto-hide is needed
  await db.$transaction(async (tx) => {
    // Create the StreamPostReport record
    await tx.streamPostReport.create({
      data: {
        postId,
        userId: auth.userId,
        reason,
        description: description || null,
      },
    })

    // 8. If this is the 3rd+ report on the same post, auto-hide it
    const reportCount = await tx.streamPostReport.count({
      where: { postId },
    })

    if (reportCount >= 3 && !post.isHidden) {
      await tx.streamPost.update({
        where: { id: postId },
        data: { isHidden: true },
      })
    }
  })

  // 9. Return success response
  return successResponse(
    { postId },
    'Report submitted successfully',
  )
})
