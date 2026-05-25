import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/banners - Public endpoint for active banners
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const position = searchParams.get('position') // optional filter

    const where: Record<string, unknown> = { isActive: true }
    if (position) where.position = position

    // Only show banners within their date range
    const now = new Date()

    const banners = await db.banner.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })

    // Filter by date range (only if dates are set)
    const filtered = banners.filter((b) => {
      if (b.startDate && new Date(b.startDate) > now) return false
      if (b.endDate && new Date(b.endDate) < now) return false
      return true
    })

    return NextResponse.json({ success: true, data: filtered })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
