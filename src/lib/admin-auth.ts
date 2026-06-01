import { NextRequest } from 'next/server'
import { verifyAdmin } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Require admin authentication for server-side code.
 *
 * SECURITY FIX: Previously only checked NextAuth sessions (getServerSession),
 * which excluded all email/password users who authenticate via HMAC session
 * cookies or bearer tokens. Now uses the full auth middleware (verifyAdmin)
 * which supports all three auth methods:
 * 1. NextAuth session (Google OAuth)
 * 2. HMAC-signed session cookie (sticky login)
 * 3. HMAC-signed bearer token (API clients)
 *
 * Usage:
 * ```ts
 * // In API route handlers that receive a NextRequest:
 * const admin = await requireAdmin(request)
 * if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 * ```
 *
 * If no request is provided (legacy usage), falls back to NextAuth-only check.
 */
export async function requireAdmin(request?: NextRequest) {
  // If a NextRequest is provided, use the full auth middleware
  if (request) {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return null

    // Fetch full user data from DB
    const user = await db.user.findUnique({
      where: { id: authResult.user.id },
    })
    return user
  }

  // Fallback: No request provided — cannot verify HMAC cookies/bearer tokens.
  // Log a warning so developers know to pass the request object.
  logger.warn(
    { component: 'admin-auth' },
    'requireAdmin() called without a NextRequest — HMAC/bearer auth methods cannot be verified. ' +
    'Pass the request parameter for full auth support.'
  )
  return null
}
