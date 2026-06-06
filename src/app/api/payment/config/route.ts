import { NextRequest, NextResponse } from 'next/server'
import { getMidtransClientConfig, MIDTRANS_SERVER_KEY, MIDTRANS_SERVER_IS_PRODUCTION, isSandboxKey, isProductionKey } from '@/lib/midtrans-config'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'

// GET /api/payment/config — Returns Midtrans client configuration
// This ensures the client Snap.js always uses the same environment as the server,
// preventing "access denied due to unauthorized transaction" errors from sandbox/production mismatch.
// No auth required for basic client config — this only returns public client key + environment flag.
// Auth IS required for the diagnostic mode (?diagnostic=true).

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const isDiagnostic = searchParams.get('diagnostic') === 'true'

  // Basic client config — no auth required
  const config = getMidtransClientConfig()

  if (!isDiagnostic) {
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Midtrans not configured' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        clientKey: config.clientKey,
        isProduction: config.isProduction,
        snapJsUrl: config.snapJsUrl,
      },
    })
  }

  // ==================== DIAGNOSTIC MODE ====================
  // Requires admin/seller authentication — shows full Midtrans configuration
  // for debugging "access denied" and "Bad Request" errors.

  const authResult = await verifyAuth(request)
  if (!authResult.success) return authErrorResponse(authResult)

  // Only allow admin or seller to access diagnostics
  if (!['admin', 'seller'].includes(authResult.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden - Admin or seller access required for diagnostics' },
      { status: 403 }
    )
  }

  const serverKey = MIDTRANS_SERVER_KEY
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
  const envFlagProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

  // Key prefix analysis
  const serverKeyPrefix = serverKey ? serverKey.substring(0, 12) + '...' : '(not set)'
  const clientKeyPrefix = clientKey ? clientKey.substring(0, 12) + '...' : '(not set)'
  const serverKeyIsSandbox = serverKey ? isSandboxKey(serverKey) : false
  const serverKeyIsProduction = serverKey ? isProductionKey(serverKey) : false
  const clientKeyIsSandbox = clientKey ? isSandboxKey(clientKey) : false
  const clientKeyIsProduction = clientKey ? isProductionKey(clientKey) : false

  // Detect mismatches
  const issues: string[] = []

  if (!serverKey) {
    issues.push('MIDTRANS_SERVER_KEY is not set — payments will fail')
  }
  if (!clientKey) {
    issues.push('NEXT_PUBLIC_MIDTRANS_CLIENT_KEY is not set — Snap popup will fail')
  }

  // Sandbox/Production mismatch detection
  if (serverKey && clientKey) {
    if (serverKeyIsSandbox && clientKeyIsProduction) {
      issues.push('CRITICAL: Server key is SANDBOX but client key is PRODUCTION — this causes "access denied" errors')
    }
    if (serverKeyIsProduction && clientKeyIsSandbox) {
      issues.push('CRITICAL: Server key is PRODUCTION but client key is SANDBOX — this causes "access denied" errors')
    }
  }

  // ENV flag vs key prefix mismatch
  if (serverKeyIsSandbox && envFlagProduction) {
    issues.push('WARNING: MIDTRANS_IS_PRODUCTION=true but server key has sandbox prefix (SB-Mid-) — auto-detected to sandbox')
  }
  if (serverKeyIsProduction && !envFlagProduction) {
    issues.push('WARNING: MIDTRANS_IS_PRODUCTION=false but server key has production prefix (Mid-) — auto-detected to production')
  }

  // Unknown key prefix
  if (serverKey && !serverKeyIsSandbox && !serverKeyIsProduction) {
    issues.push('WARNING: Server key prefix is unrecognized (expected SB-Mid- or Mid-) — may cause authentication errors')
  }
  if (clientKey && !clientKeyIsSandbox && !clientKeyIsProduction) {
    issues.push('WARNING: Client key prefix is unrecognized (expected SB-Mid- or Mid-) — may cause authentication errors')
  }

  return NextResponse.json({
    success: true,
    data: {
      // Auto-detected environment
      isProduction: MIDTRANS_SERVER_IS_PRODUCTION,
      environment: MIDTRANS_SERVER_IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX',

      // Key information (masked for security)
      serverKeyPrefix,
      clientKeyPrefix,
      serverKeyEnvironment: serverKeyIsSandbox ? 'sandbox' : serverKeyIsProduction ? 'production' : 'unknown',
      clientKeyEnvironment: clientKeyIsSandbox ? 'sandbox' : clientKeyIsProduction ? 'production' : 'unknown',

      // Environment variable flags
      MIDTRANS_IS_PRODUCTION: envFlagProduction,
      MIDTRANS_SERVER_KEY_SET: !!serverKey,
      NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_SET: !!clientKey,

      // Issues detected
      issues: issues.length > 0 ? issues : undefined,
      status: issues.length === 0 ? 'OK' : 'ISSUES_DETECTED',

      // URLs being used
      snapApiUrl: MIDTRANS_SERVER_IS_PRODUCTION
        ? 'https://app.midtrans.com/snap/v1/transactions'
        : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
      midtransApiUrl: MIDTRANS_SERVER_IS_PRODUCTION
        ? 'https://api.midtrans.com'
        : 'https://api.sandbox.midtrans.com',
      snapJsUrl: config?.snapJsUrl || '(not available)',
    },
  })
}
