import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// GET /api/test-db - Test database connection (ADMIN ONLY)
// SECURITY: Previously had NO auth — exposed DB info to anyone
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not available in production' }, { status: 404 })
  }

  try {
    // SECURITY: Admin-only access — database info is sensitive
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Check which database we're connected to
    const dbInfo = await db.$queryRaw`SELECT current_database() as db_name, inet_server_addr() as server_addr, inet_server_port() as server_port, version() as pg_version`
    return NextResponse.json({ connected: true, dbInfo })
  } catch (error: unknown) {
    // Don't leak internal error details — log server-side only
    const err = error as { message?: string; code?: string; meta?: unknown }
    logger.error({ err, code: err.code }, 'Database connection test failed')
    return NextResponse.json({
      connected: false,
      error: 'Database connection failed. Check server logs for details.',
    }, { status: 500 })
  }
}
