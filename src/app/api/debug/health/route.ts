import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

// GET /api/debug/health - Diagnostic endpoint to check Vercel deployment health
// SECURITY: Always requires admin authentication
export async function GET(request: NextRequest) {
  // SECURITY: Always require admin auth — even in non-production
  const authResult = await verifyAdmin(request)
  if (!authResult.success) {
    return authErrorResponse(authResult)
  }

  const diagnostics: Record<string, { status: string; detail?: string }> = {}

  // 1. Check critical environment variables
  const envChecks = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'SUPABASE_DATABASE_URL',
    'SUPABASE_DIRECT_URL',
    'TOKEN_SECRET',
    'CSRF_SECRET',
    'ADMIN_SETUP_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'MIDTRANS_SERVER_KEY',
    'MIDTRANS_IS_PRODUCTION',
    'NEXT_PUBLIC_MIDTRANS_CLIENT_KEY',
    'NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  const missing: string[] = []
  for (const key of envChecks) {
    const value = process.env[key]
    if (!value || value === '') {
      missing.push(key)
    }
  }

  diagnostics.envVars = {
    status: missing.length === 0 ? 'ok' : 'missing',
    detail: missing.length > 0
      ? `${missing.length} of ${envChecks.length} vars missing`
      : `All ${envChecks.length} vars present`,
  }

  // 2. Check VERCEL_URL
  diagnostics.vercelUrl = {
    status: process.env.VERCEL_URL ? 'ok' : 'missing',
    detail: process.env.VERCEL_URL || 'Not set (auto-provided by Vercel)',
  }

  // 3. Check database connectivity
  try {
    await db.$queryRaw`SELECT 1 as health`
    diagnostics.database = {
      status: 'ok',
      detail: 'Connection successful',
    }
  } catch (error: any) {
    diagnostics.database = {
      status: 'error',
      detail: `${error.code || 'UNKNOWN'}: ${error.message?.substring(0, 200)}`,
    }
  }

  // 4. Check if database has users (for login)
  try {
    const userCount = await db.user.count()
    diagnostics.users = {
      status: userCount > 0 ? 'ok' : 'empty',
      detail: `${userCount} users in database`,
    }
  } catch (error: any) {
    diagnostics.users = {
      status: 'error',
      detail: error.message?.substring(0, 200),
    }
  }

  // 5. Check if admin users exist (without revealing emails or password hashes)
  try {
    diagnostics.adminUsers = {
      status: (await db.user.count({ where: { role: 'admin', isActive: true } })) > 0 ? 'ok' : 'missing',
      detail: `${await db.user.count({ where: { role: 'admin' } })} admin users in database`,
    }
  } catch (error: any) {
    diagnostics.adminUsers = {
      status: 'error',
      detail: error.message?.substring(0, 200),
    }
  }

  // Overall status
  const allOk = Object.values(diagnostics).every(d => d.status === 'ok' || d.status === 'present')
  const hasErrors = Object.values(diagnostics).some(d => d.status === 'error' || d.status === 'missing')

  return NextResponse.json({
    success: true,
    overall: hasErrors ? 'ISSUES_FOUND' : 'ALL_OK',
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    diagnostics,
  })
}
