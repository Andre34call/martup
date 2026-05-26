import { PrismaClient } from '@prisma/client'

// Fix: System environment may have a stale SQLite DATABASE_URL that overrides .env
// We use SUPABASE_DATABASE_URL / SUPABASE_DIRECT_URL in Prisma schema to avoid conflict
// But at runtime, we also need to ensure the Prisma client gets the correct URLs
if (process.env.SUPABASE_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.SUPABASE_DATABASE_URL
}
if (process.env.SUPABASE_DIRECT_URL) {
  process.env.DIRECT_URL = process.env.SUPABASE_DIRECT_URL
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Build the connection URL with serverless-optimized parameters for Vercel
function getConnectionUrl(): string {
  let url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || ''
  
  if (url && process.env.VERCEL) {
    // On Vercel, add connection pooling parameters for serverless
    if (!url.includes('connection_limit')) {
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}connection_limit=1&pool_timeout=20`
    }
  }
  
  return url
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: getConnectionUrl(),
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
