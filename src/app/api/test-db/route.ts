import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

// GET /api/test-db - Test database connection (ADMIN ONLY)
// SECURITY: Previously had NO auth — exposed DB info to anyone
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Admin-only access — database info is sensitive
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Check which database we're connected to
    const dbInfo = await db.$queryRaw`SELECT current_database() as db_name, inet_server_addr() as server_addr, inet_server_port() as server_port, version() as pg_version`
    return NextResponse.json({ connected: true, dbInfo })
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; meta?: unknown }
    return NextResponse.json({
      connected: false,
      error: err.message?.substring(0, 500),
      code: err.code,
      meta: err.meta,
    }, { status: 500 })
  }
}
