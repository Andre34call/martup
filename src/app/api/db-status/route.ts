import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/db-status - Public database connectivity check.
 * This endpoint is intentionally UNAUTHENTICATED so that anyone can verify
 * whether the database is accessible. It only reveals connectivity status,
 * NOT any data, credentials, or internal details.
 */
export async function GET() {
  // Diagnostic: show which URL pattern is being used (without revealing secrets)
  const dbUrl = process.env.DATABASE_URL || ''
  const supabaseUrl = process.env.SUPABASE_DATABASE_URL || ''
  const dbUrlProtocol = dbUrl.startsWith('postgresql://') ? 'postgresql' : dbUrl.startsWith('postgres://') ? 'postgres' : dbUrl.startsWith('file:') ? 'file' : 'unknown'
  const dbUrlHost = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') ? new URL(dbUrl).hostname : 'n/a'
  const supabaseHost = supabaseUrl.startsWith('postgresql://') || supabaseUrl.startsWith('postgres://') ? new URL(supabaseUrl).hostname : 'n/a'

  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1 as health`
    const latencyMs = Date.now() - start

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      latencyMs,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    // Determine the type of database error for the response
    const isAuthFailed = error?.message?.includes('Authentication failed against database server')
    const isUnreachable = error?.message?.includes("Can't reach database server")
    const isTimeout = error?.code === 'P1002'
    const isPrismaInit = error?.name === 'PrismaClientInitializationError'

    let detail: string
    if (isAuthFailed) {
      detail = 'AUTH_FAILED'
    } else if (isUnreachable) {
      detail = 'UNREACHABLE'
    } else if (isTimeout) {
      detail = 'TIMEOUT'
    } else if (isPrismaInit) {
      detail = 'INIT_ERROR'
    } else {
      detail = 'UNKNOWN'
    }

    logger.error({ err: error, detail }, 'Database status check failed')

    return NextResponse.json({
      status: 'error',
      database: 'disconnected',
      detail,
      // Diagnostic info (safe to show — no passwords)
      diag: {
        DATABASE_URL_protocol: dbUrlProtocol,
        DATABASE_URL_host: dbUrlHost,
        SUPABASE_DATABASE_URL_host: supabaseHost,
        effectiveHost: dbUrlProtocol === 'postgresql' || dbUrlProtocol === 'postgres' ? dbUrlHost : supabaseHost || 'none',
      },
      hint: isAuthFailed
        ? 'Database password is incorrect. Update DATABASE_URL in Vercel Dashboard → Settings → Environment Variables.'
        : isUnreachable
          ? 'Database server is unreachable. Check if the Supabase project is paused or the URL is correct.'
          : 'Check Vercel logs for details.',
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
