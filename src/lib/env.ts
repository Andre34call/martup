// Centralized environment variable validation
// This module validates critical env vars at startup time
// Missing required vars will throw an error with a clear message

const requiredVars = [
  'NEXTAUTH_SECRET',
  'SUPABASE_DATABASE_URL',
] as const

const recommendedVars = [
  'TOKEN_SECRET',
  'CSRF_SECRET',
  'CRON_SECRET',
] as const

// Validate at module load time
const missing = requiredVars.filter(v => !process.env[v])
if (missing.length > 0 && process.env.NODE_ENV === 'production') {
  throw new Error(
    `[FATAL] Missing required environment variables: ${missing.join(', ')}. ` +
    `Application cannot start without them.`
  )
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
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL || '',
  SUPABASE_DIRECT_URL: process.env.SUPABASE_DIRECT_URL || '',
  TOKEN_SECRET: process.env.TOKEN_SECRET || process.env.NEXTAUTH_SECRET || '',
  CSRF_SECRET: process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || '',
  CRON_SECRET: process.env.CRON_SECRET || '',
  SMS_PROVIDER: process.env.SMS_PROVIDER || 'mock',
  MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || '',
  MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const
