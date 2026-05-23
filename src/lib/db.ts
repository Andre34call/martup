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

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
