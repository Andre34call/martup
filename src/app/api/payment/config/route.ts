import { NextRequest, NextResponse } from 'next/server'
import {
  isDuitkuConfigured,
  isDuitkuProduction,
  getDuitkuMerchantCode,
  getDuitkuCallbackUrl,
  getDuitkuReturnUrl,
  getDuitkuAppBaseUrl,
  getDuitkuApiBaseUrl,
} from '@/lib/duitku'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'

// GET /api/payment/config — Returns Duitku payment configuration for the client.
// No auth required for basic config — only returns a boolean flag + environment info.
// Auth IS required for the diagnostic mode (?diagnostic=true).

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const isDiagnostic = searchParams.get('diagnostic') === 'true'

  const configured = isDuitkuConfigured()
  const isProduction = isDuitkuProduction()

  if (!isDiagnostic) {
    return NextResponse.json({
      success: true,
      data: {
        provider: 'duitku',
        enabled: configured,
        isProduction,
        paymentPageBase: getDuitkuAppBaseUrl(),
      },
    })
  }

  // ==================== DIAGNOSTIC MODE ====================
  // Requires admin/seller authentication — shows full Duitku configuration
  // for debugging callback/return URL and environment issues.

  const authResult = await verifyAuth(request)
  if (!authResult.success) return authErrorResponse(authResult)

  // Only allow admin or seller to access diagnostics
  if (!['admin', 'seller'].includes(authResult.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden - Admin or seller access required for diagnostics' },
      { status: 403 }
    )
  }

  const merchantCode = getDuitkuMerchantCode()
  const issues: string[] = []

  if (!merchantCode) issues.push('DUITKU_MERCHANT_CODE is not set — payments will fail')
  if (!process.env.DUITKU_API_KEY) issues.push('DUITKU_API_KEY is not set — payments will fail')
  if (!process.env.DUITKU_IS_PRODUCTION) {
    issues.push('DUITKU_IS_PRODUCTION is not set — defaulting to SANDBOX mode')
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000'
  if (baseUrl.includes('localhost')) {
    issues.push('Callback/return URLs use localhost — Duitku webhooks will NOT work in local development. Deploy to Vercel or expose a public URL.')
  }

  return NextResponse.json({
    success: true,
    data: {
      provider: 'duitku',
      enabled: configured,
      environment: isProduction ? 'PRODUCTION' : 'SANDBOX',
      isProduction,
      merchantCodeMasked: merchantCode ? merchantCode.substring(0, 2) + '***' : '(not set)',
      callbackUrl: getDuitkuCallbackUrl(),
      returnUrl: getDuitkuReturnUrl(),
      apiBaseUrl: getDuitkuApiBaseUrl(),
      envVars: {
        DUITKU_MERCHANT_CODE_SET: !!merchantCode,
        DUITKU_API_KEY_SET: !!process.env.DUITKU_API_KEY,
        DUITKU_IS_PRODUCTION: process.env.DUITKU_IS_PRODUCTION || '(unset → sandbox)',
      },
      issues: issues.length > 0 ? issues : undefined,
      status: issues.length === 0 ? 'OK' : 'ISSUES_DETECTED',
    },
  })
}
