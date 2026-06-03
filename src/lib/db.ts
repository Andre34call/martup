import { PrismaClient } from '@prisma/client'

// Use DATABASE_URL from environment (PostgreSQL via Supabase).
// If DATABASE_URL points to SQLite (local dev override), fall back to SUPABASE_DATABASE_URL.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL || ''
  // If DATABASE_URL is a PostgreSQL URL, use it directly
  if (envUrl.startsWith('postgresql://') || envUrl.startsWith('postgres://')) {
    return envUrl
  }
  // Otherwise, fall back to SUPABASE_DATABASE_URL (e.g., when DATABASE_URL is SQLite for local dev)
  const supabaseUrl = process.env.SUPABASE_DATABASE_URL || ''
  if (supabaseUrl.startsWith('postgresql://') || supabaseUrl.startsWith('postgres://')) {
    return supabaseUrl
  }
  // Last resort: use DATABASE_URL as-is (will likely fail, but gives a clear error)
  return envUrl
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
