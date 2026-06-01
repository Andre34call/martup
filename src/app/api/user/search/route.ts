import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Auth required
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Rate limit: 30 searches per minute per user
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(`user-search:${authResult.user.id}:${clientIp}`, 30)) {
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
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { username: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
      },
      take: limit,
      orderBy: [
        { username: { sort: 'asc', nulls: 'last' } },
        { name: 'asc' },
      ],
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
