import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/auth/check - Diagnostic endpoint for auth troubleshooting
// Placed in /api/auth/ directory so it's guaranteed to be deployed alongside login
export async function GET(request: NextRequest) {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    vercelUrl: process.env.VERCEL_URL || 'not set',
  }

  // 1. Check env vars (mask sensitive values)
  const envChecks: Record<string, string> = {}
  const envKeys = [
    'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'SUPABASE_DATABASE_URL',
    'SUPABASE_DIRECT_URL', 'TOKEN_SECRET', 'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 'MIDTRANS_SERVER_KEY',
  ]
  for (const key of envKeys) {
    const val = process.env[key]
    if (!val) {
      envChecks[key] = '❌ NOT SET'
    } else if (val.length > 20) {
      envChecks[key] = `✅ Set (${val.substring(0, 8)}...${val.substring(val.length - 4)})`
    } else {
      envChecks[key] = `✅ Set (${val.length} chars)`
    }
  }
  diagnostics.envVars = envChecks

  // 2. Check database connectivity
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1 as health`
    diagnostics.database = {
      status: '✅ Connected',
      responseTime: `${Date.now() - start}ms`,
    }
  } catch (error: any) {
    diagnostics.database = {
      status: '❌ Failed',
      error: error?.message?.substring(0, 200),
      code: error?.code,
    }
  }

  // 3. Check if admin user exists
  try {
    const adminUser = await db.user.findUnique({ where: { email: 'admin@martup.com' } })
    diagnostics.adminUser = adminUser
      ? { status: '✅ Found', hasPassword: !!adminUser.password, passwordType: adminUser.password?.startsWith('$2') ? 'bcrypt' : 'plain', role: adminUser.role, isActive: adminUser.isActive, isVerified: adminUser.isVerified }
      : { status: '❌ NOT FOUND', hint: 'Run /api/admin/setup or /api/admin/init to create' }
  } catch (error: any) {
    diagnostics.adminUser = { status: '❌ Query failed', error: error?.message?.substring(0, 100), code: error?.code }
  }

  // 4. Check NEXTAUTH_URL correctness
  const nextauthUrl = process.env.NEXTAUTH_URL
  if (nextauthUrl) {
    diagnostics.nextauthUrlCheck = nextauthUrl.includes('localhost')
      ? `⚠️ WRONG: ${nextauthUrl} — should be production URL on Vercel`
      : `✅ ${nextauthUrl}`
  } else {
    diagnostics.nextauthUrlCheck = process.env.VERCEL_URL
      ? `⚠️ Not set, but VERCEL_URL is available (${process.env.VERCEL_URL}) — auth.ts auto-fix should handle this`
      : '❌ Not set and no VERCEL_URL'
  }

  return NextResponse.json(diagnostics, { status: 200 })
}
