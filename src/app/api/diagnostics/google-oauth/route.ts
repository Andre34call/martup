import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { verifySuperAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'

/**
 * GET /api/diagnostics/google-oauth
 *
 * Diagnostic endpoint for Google OAuth configuration.
 * SECURITY: Only accessible in development by super admins.
 * Returns 404 in production.
 */
export async function GET(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  // Require super admin
  const authResult = await verifySuperAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  const startTime = Date.now()

  // Check DB reachability
  let dbReachable = false
  let dbLatencyMs: number | null = null
  let dbError: string | null = null
  try {
    const dbStart = Date.now()
    await db.$queryRaw`SELECT 1`
    dbReachable = true
    dbLatencyMs = Date.now() - dbStart
  } catch (err) {
    dbReachable = false
    dbError = err instanceof Error ? err.message : String(err)
  }

  // Compute the expected redirect URI
  const computedNextauthUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    vercelUrl: process.env.VERCEL_URL
      ? `(set: ${process.env.VERCEL_URL})`
      : '(not set — on Vercel this should be auto-provided)',
    nextauthUrl: process.env.NEXTAUTH_URL
      ? `(set: ${process.env.NEXTAUTH_URL})`
      : '(not set — will fall back to VERCEL_URL or localhost)',
    nextauthUrlEffective: computedNextauthUrl,
    nextauthSecret: process.env.NEXTAUTH_SECRET ? '(set ✓)' : '(NOT SET ✗ — required for Google OAuth)',
    googleClientId: env.GOOGLE_CLIENT_ID ? '(set ✓)' : '(NOT SET ✗ — required for Google OAuth)',
    googleClientSecret: env.GOOGLE_CLIENT_SECRET ? '(set ✓)' : '(NOT SET ✗ — required for Google OAuth)',
    internalApiSecret: process.env.INTERNAL_API_SECRET
      ? '(set ✓)'
      : process.env.NEXTAUTH_SECRET
        ? '(not set, falling back to NEXTAUTH_SECRET ✓)'
        : '(NOT SET ✗ — no fallback available)',
    supabaseDatabaseUrl: env.SUPABASE_DATABASE_URL ? '(set ✓)' : '(NOT SET ✗ — required for DB)',
    database: {
      reachable: dbReachable,
      latencyMs: dbLatencyMs,
      error: dbError,
    },
    redirectUri: `${computedNextauthUrl}/api/auth/callback/google`,
    issues: [] as string[],
    totalLatencyMs: 0,
  }

  // Check for issues
  if (!process.env.NEXTAUTH_SECRET) {
    diagnostics.issues.push(
      'NEXTAUTH_SECRET is not set. Google OAuth will NOT work because JWT tokens cannot be signed/verified consistently across serverless invocations. ' +
      'Fix: Set NEXTAUTH_SECRET in Vercel Dashboard → Settings → Environment Variables.'
    )
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    diagnostics.issues.push(
      'GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET is not set. The Google OAuth flow cannot start. ' +
      'Fix: Set both in Vercel Dashboard → Settings → Environment Variables.'
    )
  }

  if (!process.env.VERCEL_URL && !process.env.NEXTAUTH_URL) {
    diagnostics.issues.push(
      'Neither VERCEL_URL nor NEXTAUTH_URL is set. NextAuth cannot determine the correct callback URL. ' +
      'On Vercel, VERCEL_URL is auto-provided. For custom domains, set NEXTAUTH_URL explicitly.'
    )
  } else if (process.env.NEXTAUTH_URL && (process.env.NEXTAUTH_URL.includes('localhost') || process.env.NEXTAUTH_URL.includes('127.0.0.1'))) {
    diagnostics.issues.push(
      `NEXTAUTH_URL is set to "${process.env.NEXTAUTH_URL}" which points to localhost. ` +
      'This will NOT work in production. On Vercel, either remove NEXTAUTH_URL (to use auto-detected VERCEL_URL) ' +
      'or set it to your production URL (e.g., https://martup-seven.vercel.app).'
    )
  }

  if (!dbReachable) {
    diagnostics.issues.push(
      `Database is unreachable: ${dbError || 'unknown error'}. ` +
      'The JWT callback and sync-user endpoint both require DB access. ' +
      'Google OAuth sign-in may succeed but the session will be unstable. ' +
      'Check SUPABASE_DATABASE_URL in Vercel Dashboard → Settings → Environment Variables.'
    )
  }

  if (!process.env.INTERNAL_API_SECRET && !process.env.NEXTAUTH_SECRET) {
    diagnostics.issues.push(
      'Neither INTERNAL_API_SECRET nor NEXTAUTH_SECRET is set. The signIn callback cannot authenticate with the sync-user endpoint. ' +
      'Fix: Set INTERNAL_API_SECRET (recommended) or NEXTAUTH_SECRET in Vercel Dashboard → Settings → Environment Variables.'
    )
  }

  if (diagnostics.issues.length === 0) {
    diagnostics.issues.push(
      'All checks passed ✓. If Google OAuth still fails, check:' +
      ' 1) Google Cloud Console → Credentials → Authorized redirect URIs includes: ' + diagnostics.redirectUri +
      ' 2) Google Cloud Console → OAuth consent screen is configured' +
      ' 3) Google Cloud Console → APIs & Services → Google+ API is enabled' +
      ' 4) Browser network tab for the exact error response from /api/auth/callback/google'
    )
  }

  diagnostics.totalLatencyMs = Date.now() - startTime

  logger.info({ component: 'auth-diagnostic', dbReachable, totalLatencyMs: diagnostics.totalLatencyMs }, 'Google OAuth diagnostic requested')

  return NextResponse.json(diagnostics)
}
