import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { verifySuperAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// GET /api/auth/diagnostic - Check auth configuration status
// Only accessible by Super Admin to prevent information disclosure
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not available in production' }, { status: 404 })
  }

  try {
    const authResult = await verifySuperAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const diagnostic = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL,
      vercelUrl: process.env.VERCEL_URL || null,
      // Google OAuth
      googleOAuth: {
        configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        hasClientId: !!env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!env.GOOGLE_CLIENT_SECRET,
        clientIdPrefix: env.GOOGLE_CLIENT_ID ? env.GOOGLE_CLIENT_ID.substring(0, 8) + '...' : null,
      },
      // NextAuth
      nextAuth: {
        hasNextAuthSecret: !!env.NEXTAUTH_SECRET,
        nextAuthUrl: env.NEXTAUTH_URL || null,
        nextAuthUrlIsLocalhost: env.NEXTAUTH_URL?.includes('localhost') || false,
      },
      // Email
      email: {
        provider: env.EMAIL_PROVIDER,
        hasResendApiKey: !!env.RESEND_API_KEY,
        resendApiKeyPrefix: env.RESEND_API_KEY ? env.RESEND_API_KEY.substring(0, 6) + '...' : null,
        emailFrom: process.env.EMAIL_FROM || 'MartUp <noreply@martup.id>',
      },
      // Super Admin
      superAdmin: {
        email: env.SUPER_ADMIN_EMAIL || '(not set)',
      },
      // Token Security
      tokenSecurity: {
        hasTokenSecret: !!env.TOKEN_SECRET,
        hasCsrfSecret: !!env.CSRF_SECRET,
      },
    }

    // Add recommendations
    const recommendations: string[] = []
    
    if (!diagnostic.googleOAuth.configured) {
      recommendations.push('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel Dashboard → Settings → Environment Variables to enable Google login')
    }
    if (!diagnostic.nextAuth.hasNextAuthSecret) {
      recommendations.push('Set NEXTAUTH_SECRET in Vercel Dashboard — required for session tokens and OAuth')
    }
    if (diagnostic.nextAuth.nextAuthUrlIsLocalhost) {
      recommendations.push('NEXTAUTH_URL is set to localhost — change it to your production URL (e.g., https://martup-seven.vercel.app)')
    }
    if (diagnostic.email.provider === 'mock') {
      recommendations.push('EMAIL_PROVIDER is "mock" — emails will NOT be sent. Set EMAIL_PROVIDER=resend and RESEND_API_KEY in Vercel Dashboard')
    }
    if (!diagnostic.email.hasResendApiKey && diagnostic.email.provider === 'resend') {
      recommendations.push('EMAIL_PROVIDER is "resend" but RESEND_API_KEY is not set — emails will fail to send')
    }
    if (!diagnostic.superAdmin.email) {
      recommendations.push('SUPER_ADMIN_EMAIL is not set — Super Admin features will not work')
    }

    return NextResponse.json({
      success: true,
      diagnostic,
      recommendations: recommendations.length > 0 ? recommendations : ['All configurations look good ✅'],
    })
  } catch (error) {
    logger.error({ err: error }, 'Auth diagnostic error')
    return NextResponse.json(
      { success: false, error: 'Diagnostic failed' },
      { status: 500 }
    )
  }
}
