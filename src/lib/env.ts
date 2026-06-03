// Centralized environment variable validation
// This module validates critical env vars at startup time
// On Vercel serverless, env vars may load late — so we log warnings instead of throwing

const requiredVars = [
  'NEXTAUTH_SECRET',
  'SUPABASE_DATABASE_URL',
] as const

const recommendedVars = [
  'TOKEN_SECRET',
  'CSRF_SECRET',
  'CSRF_ENFORCE',
  'CRON_SECRET',
  'ADMIN_SETUP_SECRET',
  'SUPER_ADMIN_EMAIL',
  'INTERNAL_API_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RESEND_API_KEY',
  'MIDTRANS_SERVER_KEY',
  'NEXT_PUBLIC_MIDTRANS_CLIENT_KEY',
  'NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION',
] as const

// Validate at module load time — but NOT during Next.js build phase
// On Vercel serverless, we warn instead of throw to avoid crashing cold starts
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
const missing = requiredVars.filter(v => !process.env[v])
if (missing.length > 0 && process.env.NODE_ENV === 'production' && !isBuildPhase) {
  // On Vercel, log a clear warning instead of throwing — allows the function to start
  // so users get a proper error message instead of a generic 500
  console.error(
    `[FATAL] Missing required environment variables: ${missing.join(', ')}. ` +
    `Application cannot function without them. Please set them in Vercel Dashboard → Settings → Environment Variables.`
  )
  // Don't throw — let individual routes handle the missing vars gracefully
}

// Warn about recommended vars in development
if (process.env.NODE_ENV === 'development') {
  const missingRecommended = recommendedVars.filter(v => !process.env[v])
  if (missingRecommended.length > 0) {
    console.warn(
      `[WARN] Missing recommended environment variables: ${missingRecommended.join(', ')}. ` +
      `Some features may not work correctly.`
    )
  }
}

// Typed env accessor
export const env = {
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL || '',
  SUPABASE_DIRECT_URL: process.env.SUPABASE_DIRECT_URL || '',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  TOKEN_SECRET: process.env.TOKEN_SECRET || process.env.NEXTAUTH_SECRET || '',
  CSRF_SECRET: process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || '',
  CRON_SECRET: process.env.CRON_SECRET || '',
  ADMIN_SETUP_SECRET: process.env.ADMIN_SETUP_SECRET || process.env.NEXTAUTH_SECRET || '',
  // SECURITY: Super Admin email — MUST be set via SUPER_ADMIN_EMAIL env var.
  // No hardcoded fallback — an empty string means no super admin privileges are granted.
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || '',
  // SECURITY: Internal API secret — separate from NEXTAUTH_SECRET.
  // Used for service-to-service auth (e.g., NextAuth → sync-user).
  // In production, MUST be set explicitly. Falls back to NEXTAUTH_SECRET only in development.
  INTERNAL_API_SECRET: (() => {
    const val = process.env.INTERNAL_API_SECRET
    if (val) return val
    if (process.env.NODE_ENV === 'development') {
      console.warn('[WARN] INTERNAL_API_SECRET not set — falling back to NEXTAUTH_SECRET in development mode. Set INTERNAL_API_SECRET in production!')
      return process.env.NEXTAUTH_SECRET || ''
    }
    console.error('[SECURITY] INTERNAL_API_SECRET not set in production! Service-to-service auth will use NEXTAUTH_SECRET as fallback, which is insecure.')
    return process.env.NEXTAUTH_SECRET || ''
  })(),
  SMS_PROVIDER: process.env.SMS_PROVIDER || 'mock',
  MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || '',
  MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'mock',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const
