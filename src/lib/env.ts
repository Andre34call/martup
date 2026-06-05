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
  'RAJAONGKIR_API_KEY',
  'RAJAONGKIR_PACKAGE',
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
  // SECURITY: All secrets below MUST be set explicitly in production.
  // In development, they fall back to NEXTAUTH_SECRET for convenience.
  // In production, an empty string is returned if not set — features will fail rather than use a shared secret.
  TOKEN_SECRET: (() => {
    const val = process.env.TOKEN_SECRET
    if (val) return val
    if (process.env.NODE_ENV === 'development') {
      console.warn('[WARN] TOKEN_SECRET not set — falling back to NEXTAUTH_SECRET in development mode. Set TOKEN_SECRET in production!')
      return process.env.NEXTAUTH_SECRET || ''
    }
    console.error('[SECURITY] TOKEN_SECRET not set in production! Bearer token signing will fail.')
    return ''
  })(),
  CSRF_SECRET: (() => {
    const val = process.env.CSRF_SECRET
    if (val) return val
    if (process.env.NODE_ENV === 'development') {
      console.warn('[WARN] CSRF_SECRET not set — falling back to NEXTAUTH_SECRET in development mode. Set CSRF_SECRET in production!')
      return process.env.NEXTAUTH_SECRET || ''
    }
    console.error('[SECURITY] CSRF_SECRET not set in production! CSRF protection will fail.')
    return ''
  })(),
  CRON_SECRET: process.env.CRON_SECRET || '',
  ADMIN_SETUP_SECRET: (() => {
    const val = process.env.ADMIN_SETUP_SECRET
    if (val) return val
    if (process.env.NODE_ENV === 'development') {
      console.warn('[WARN] ADMIN_SETUP_SECRET not set — falling back to NEXTAUTH_SECRET in development mode. Set ADMIN_SETUP_SECRET in production!')
      return process.env.NEXTAUTH_SECRET || ''
    }
    console.error('[SECURITY] ADMIN_SETUP_SECRET not set in production! Admin setup will fail.')
    return ''
  })(),
  // SECURITY: Super Admin email — MUST be set via SUPER_ADMIN_EMAIL env var.
  // No hardcoded fallback — an empty string means no super admin privileges are granted.
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || '',
  // SECURITY: Internal API secret — used for service-to-service auth (e.g., NextAuth → sync-user).
  // Best practice: Set INTERNAL_API_SECRET explicitly in production for secret isolation.
  // Fallback: Derives from NEXTAUTH_SECRET so Google OAuth sync-user works even without
  // explicit INTERNAL_API_SECRET. This is safe because both secrets protect the same app.
  INTERNAL_API_SECRET: (() => {
    const val = process.env.INTERNAL_API_SECRET
    if (val) return val
    // Always fall back to NEXTAUTH_SECRET (not just in dev) — without this,
    // the NextAuth signIn callback can't call /api/auth/sync-user, breaking Google OAuth.
    const fallback = process.env.NEXTAUTH_SECRET || ''
    if (process.env.NODE_ENV === 'production' && fallback) {
      console.warn('[WARN] INTERNAL_API_SECRET not set in production — falling back to NEXTAUTH_SECRET. Set INTERNAL_API_SECRET explicitly for better secret isolation.')
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('[WARN] INTERNAL_API_SECRET not set — falling back to NEXTAUTH_SECRET in development mode. Set INTERNAL_API_SECRET in production!')
    } else if (!fallback) {
      console.error('[SECURITY] Neither INTERNAL_API_SECRET nor NEXTAUTH_SECRET is set! Google OAuth will NOT work.')
    }
    return fallback
  })(),
  // SMS/Email providers: Default to '' (fail loudly) instead of 'mock' (silent).
  // In production, unconfigured providers should cause visible errors, not silent degradation.
  // Set SMS_PROVIDER=resend|twilio|mock and EMAIL_PROVIDER=resend|mock explicitly.
  SMS_PROVIDER: process.env.SMS_PROVIDER || (process.env.NODE_ENV === 'development' ? 'mock' : ''),
  MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || '',
  MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === 'development' ? 'mock' : ''),
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RAJAONGKIR_API_KEY: process.env.RAJAONGKIR_API_KEY || '',
  RAJAONGKIR_PACKAGE: process.env.RAJAONGKIR_PACKAGE || 'starter',
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const
