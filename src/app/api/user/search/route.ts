import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  keyPrefix: 'rl:user-search:',
})

export async function GET(request: NextRequest) {
  try {
    // Auth required
    const authResult = await verifyAuth(request)
    if (!authResult.authorized) {
      return authErrorResponse(authResult)
    }

    // Rate limit
    const rateLimitResult = await checkRateLimit(request, searchLimiter, authResult.user.id)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''
    const limitParam = parseInt(searchParams.get('limit') || '8', 10)
    const limit = Math.min(Math.max(limitParam, 1), 15)

    if (query.length < 1) {
      return NextResponse.json(
        { success: true, data: [] },
        { status: 200 }
      )
    }

    const users = await db.user.findMany({
      where: {
        isActive: true,
        id: { not: authResult.user.id },
        name: { contains: query, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        avatar: true,
      },
      take: limit,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ success: true, data: users }, { status: 200 })
  } catch (error: unknown) {
    logger.error({ err: error }, 'User search error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
