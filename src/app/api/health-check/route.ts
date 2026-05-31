import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

/**
 * GET /api/health-check - Diagnostic endpoint for system troubleshooting.
 *
 * SECURITY: Admin-only. This endpoint exposes sensitive system information
 * (env var status, DB connectivity, admin user status) that must not be public.
 *
 * Previously this endpoint was unauthenticated — that was a critical security
 * vulnerability exposing partial secret values, database info, and admin user details.
 */
export async function GET(request: NextRequest) {
  // SECURITY: Require admin access — this endpoint exposes sensitive diagnostics
  const authResult = await verifyAdmin(request)
  if (!authResult.success) {
    return authErrorResponse(authResult)
  }

  // Additional production gate — only allow in non-production or with explicit env flag
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DIAGNOSTICS !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Diagnostics endpoint disabled in production' },
      { status: 403 }
    )
  }

  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
  }

  // 1. Check env vars (mask ALL sensitive values — never expose even partial secrets)
  const envChecks: Record<string, string> = {}
  const sensitiveEnvKeys = [
    'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'SUPABASE_DATABASE_URL',
    'SUPABASE_DIRECT_URL', 'TOKEN_SECRET', 'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 'MIDTRANS_SERVER_KEY',
  ]
  for (const key of sensitiveEnvKeys) {
    const val = process.env[key]
    envChecks[key] = val ? '✅ Set' : '❌ NOT SET'
  }
  diagnostics.envVars = envChecks

  // 2. Check database connectivity (no version info leak)
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1 as health`
    diagnostics.database = {
      status: '✅ Connected',
      responseTime: `${Date.now() - start}ms`,
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message.substring(0, 100) : 'Unknown error'
    diagnostics.database = {
      status: '❌ Failed',
      error: errorMsg,
    }
  }

  // 3. Check if admin user exists (only status, no details about password type or role)
  try {
    const adminCount = await db.user.count({
      where: { role: { in: ['admin', 'manager'] } }
    })
    diagnostics.adminUser = adminCount > 0
      ? { status: '✅ Found', count: adminCount }
      : { status: '❌ NOT FOUND', hint: 'Run /api/admin/setup or /api/admin/init to create' }
  } catch (error: unknown) {
    diagnostics.adminUser = { status: '❌ Query failed' }
  }

  return NextResponse.json(diagnostics, { status: 200 })
}
