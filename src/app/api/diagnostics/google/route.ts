import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySuperAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

/**
 * GET /api/diagnostics/google - Google OAuth health check
 *
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

  try {
    // ==================== ENVIRONMENT CHECKS ====================
    const nextauthUrl = process.env.NEXTAUTH_URL || ''
    const vercelUrl = process.env.VERCEL_URL || ''
    const isVercel = !!process.env.VERCEL

    // Determine the EFFECTIVE URL that NextAuth will actually use
    const effectiveUrl = nextauthUrl && !nextauthUrl.includes('localhost')
      ? nextauthUrl
      : vercelUrl
        ? `https://${vercelUrl}`
        : 'http://localhost:3000'

    // The redirect URI that Google will receive
    const redirectUri = `${effectiveUrl}/api/auth/callback/google`

    // Check if NEXTAUTH_URL matches VERCEL_URL (deployment URL mismatch)
    const canonicalUrl = nextauthUrl.replace(/^https?:\/\//, '')
    const deploymentUrl = vercelUrl
    const urlMismatch = canonicalUrl !== deploymentUrl && isVercel

    // ==================== ENV VAR CHECKS (masked) ====================
    const envChecks = {
      nextauthUrl: nextauthUrl ? `(set: ${nextauthUrl})` : '(not set)',
      vercelUrl: vercelUrl ? `(set: ${vercelUrl})` : '(not set)',
      nextauthUrlEffective: effectiveUrl,
      nextauthSecret: process.env.NEXTAUTH_SECRET ? '(set ✓)' : '(NOT SET ✗)',
      googleClientId: process.env.GOOGLE_CLIENT_ID ? '(set ✓)' : '(NOT SET ✗)',
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? '(set ✓)' : '(NOT SET ✗)',
      internalApiSecret: process.env.INTERNAL_API_SECRET || process.env.NEXTAUTH_SECRET ? '(set ✓)' : '(NOT SET ✗)',
      supabaseDatabaseUrl: process.env.SUPABASE_DATABASE_URL ? '(set ✓)' : '(NOT SET ✗)',
    }

    // ==================== DATABASE CHECK ====================
    let dbCheck: { reachable: boolean; latencyMs: number | null; error: string | null } = {
      reachable: false,
      latencyMs: null,
      error: null,
    }

    try {
      const dbStart = Date.now()
      await db.$queryRaw`SELECT 1`
      dbCheck = {
        reachable: true,
        latencyMs: Date.now() - dbStart,
        error: null,
      }
    } catch (dbError: unknown) {
      dbCheck = {
        reachable: false,
        latencyMs: null,
        error: dbError instanceof Error ? dbError.message : 'Unknown database error',
      }
    }

    // ==================== REDIRECT URI ====================
    const redirectUriCheck = {
      uri: redirectUri,
      basedOn: urlMismatch ? 'NEXTAUTH_URL (canonical)' : effectiveUrl === nextauthUrl ? 'NEXTAUTH_URL (canonical)' : 'VERCEL_URL (deployment-specific)',
      warning: urlMismatch
        ? `NEXTAUTH_URL (${nextauthUrl}) differs from VERCEL_URL (https://${vercelUrl}). NextAuth on Vercel may use either URL depending on AUTH_TRUST_HOST. Ensure BOTH redirect URIs are registered in Google Cloud Console.`
        : undefined,
    }

    // ==================== ISSUES & RECOMMENDATIONS ====================
    const issues: string[] = []

    if (!process.env.NEXTAUTH_SECRET) {
      issues.push('NEXTAUTH_SECRET is not set. Session tokens and OAuth will NOT work. Set it in Vercel Dashboard → Settings → Environment Variables.')
    }
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      issues.push('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel Dashboard.')
    }
    if (!nextauthUrl || nextauthUrl.includes('localhost')) {
      issues.push(`NEXTAUTH_URL is "${nextauthUrl || '(not set)'}". On Vercel, set it to your production URL (e.g., https://martup-seven.vercel.app).`)
    }
    if (urlMismatch) {
      issues.push(
        `URL MISMATCH: NEXTAUTH_URL=${nextauthUrl} but VERCEL_URL=https://${vercelUrl}. ` +
        `The redirect URI sent to Google is: ${redirectUri}. ` +
        `Make sure THIS EXACT URL is registered in Google Cloud Console → Credentials → Authorized redirect URIs. ` +
        `Also add: https://${vercelUrl}/api/auth/callback/google (Vercel may use this URL internally).`
      )
    }
    if (!dbCheck.reachable) {
      issues.push(`Database unreachable: ${dbCheck.error}. Google OAuth sync-user will fail.`)
    }
    if (dbCheck.latencyMs && dbCheck.latencyMs > 5000) {
      issues.push(`Database latency is ${dbCheck.latencyMs}ms. The sync-user endpoint may timeout (>10s limit), causing Google login to fail partially.`)
    }

    if (issues.length === 0) {
      issues.push(
        'All checks passed ✓. If Google OAuth still fails, check:' +
        '\n1) Google Cloud Console → Credentials → Authorized redirect URIs includes: ' + redirectUri +
        (urlMismatch ? '\n   ALSO add: https://' + vercelUrl + '/api/auth/callback/google' : '') +
        '\n2) Google Cloud Console → OAuth consent screen is configured and published' +
        '\n3) Google Cloud Console → APIs & Services → Google+ API is enabled' +
        '\n4) Open browser DevTools → Network tab → try Google login → check the exact error response from /api/auth/callback/google' +
        '\n5) Check Vercel function logs for runtime errors during the OAuth callback'
      )
    }

    // ==================== RESPONSE ====================
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      isVercel,
      ...envChecks,
      database: dbCheck,
      redirectUri: redirectUriCheck,
      issues,
      totalLatencyMs: Date.now() - startTime,
    })
  } catch (error) {
    logger.error({ err: error }, 'Google OAuth diagnostic error')
    return NextResponse.json(
      { success: false, error: 'Diagnostic failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
