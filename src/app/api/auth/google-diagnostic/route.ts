import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

/**
 * GET /api/auth/google-diagnostic
 * 
 * Diagnostic endpoint for Google OAuth configuration.
 * Helps identify why Google login might not work.
 * Only returns non-sensitive info (presence/absence of config, not actual values).
 */
export async function GET(_request: NextRequest) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    vercelUrl: process.env.VERCEL_URL ? `(set: ${process.env.VERCEL_URL})` : '(not set)',
    nextauthUrl: process.env.NEXTAUTH_URL ? `(set)` : '(not set)',
    nextauthSecret: process.env.NEXTAUTH_SECRET ? '(set ✓)' : '(NOT SET ✗ — required for Google OAuth)',
    googleClientId: env.GOOGLE_CLIENT_ID ? '(set ✓)' : '(NOT SET ✗ — required for Google OAuth)',
    googleClientSecret: env.GOOGLE_CLIENT_SECRET ? '(set ✓)' : '(NOT SET ✗ — required for Google OAuth)',
    internalApiSecret: env.INTERNAL_API_SECRET ? '(set ✓)' : '(NOT SET — falling back to NEXTAUTH_SECRET)',
    supabaseDatabaseUrl: env.SUPABASE_DATABASE_URL ? '(set ✓)' : '(NOT SET ✗ — required for DB)',
    issues: [] as string[],
    redirectUri: '',
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

  // Compute the expected redirect URI
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000'
  diagnostics.redirectUri = `${baseUrl}/api/auth/callback/google`

  if (diagnostics.issues.length === 0) {
    diagnostics.issues.push(
      'All required env vars are set. If Google OAuth still fails, check:' +
      ' 1) Google Cloud Console → Credentials → Authorized redirect URIs includes: ' + diagnostics.redirectUri +
      ' 2) Google Cloud Console → OAuth consent screen is configured' +
      ' 3) Google Cloud Console → APIs & Services → Google+ API is enabled'
    )
  }

  logger.info({ component: 'auth-diagnostic' }, 'Google OAuth diagnostic requested')

  return NextResponse.json(diagnostics)
}
