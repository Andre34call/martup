import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import crypto from 'crypto'
import { createRateLimiter, type RateLimitResult, rateLimitHeaders } from '@/lib/rate-limit'
import { env } from '@/lib/env'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie'

// ==================== AUTH MIDDLEWARE ====================
// SECURITY OVERHAUL: Removed insecure x-auth-user-id method
// Only NextAuth session and HMAC-signed bearer tokens are accepted

// ==================== ROLE HIERARCHY ====================
// Super Admin (role='admin' + email=env.SUPER_ADMIN_EMAIL) — Full access, can promote anyone
//   └── Manager (role='manager') — Can manage divisions, promote to division admin, but not to manager/super admin
//        └── Division Admin (role='finance'|'pr'|'tech'|'cs'|'marketing'|'operations'|'legal'|'hr') — Division-specific access
//             └── Admin (role='admin' without super admin email) — Basic admin panel access
//                  └── Seller (role='seller') — Store management
//                       └── Buyer (role='buyer') — Shopping only

// All roles that have admin/staff-level access (above seller/buyer)
const ELEVATED_ROLES = ['admin', 'manager', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr'] as const
// Division-specific roles (below manager, above regular admin in division scope)
const DIVISION_ROLES = ['finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr'] as const
// Roles that a Manager can assign (division admins + regular admin)
const MANAGER_ASSIGNABLE_ROLES = ['admin', ...DIVISION_ROLES] as const

export { ELEVATED_ROLES, DIVISION_ROLES, MANAGER_ASSIGNABLE_ROLES }

// ==================== RATE LIMITING ====================
// Uses the advanced rate limiter from rate-limit.ts which supports
// both in-memory (dev) and Redis/Vercel KV (production) backends.

const apiLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60, keyPrefix: 'rl:api:' })
const authLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:auth:' })
const sensitiveLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5, keyPrefix: 'rl:sensitive:' })

/**
 * Check rate limit using the advanced rate limiter.
 * Returns the rate limit result so callers can include headers in responses.
 */
export async function checkRateLimitAdvanced(
  identifier: string,
  maxRequests: number = 60
): Promise<RateLimitResult> {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests, keyPrefix: 'rl:custom:' })
  return limiter.check(identifier)
}

/**
 * Legacy synchronous rate limit check — kept for backward compatibility.
 * DEPRECATED: Use checkRateLimitAdvanced() for new code.
 */
export function checkRateLimit(identifier: string, maxRequests: number = 60): boolean {
  // Synchronous approximation — uses in-memory fallback for immediate response
  // For production, use checkRateLimitAdvanced() which supports distributed backends
  const now = Date.now()
  if (!checkRateLimit.map) {
    checkRateLimit.map = new Map<string, { count: number; lastReset: number }>()
  }
  const rateLimitMap = checkRateLimit.map
  const entry = rateLimitMap.get(identifier)

  if (!entry || now - entry.lastReset > 60_000) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}
// Static property for the in-memory map
checkRateLimit.map = undefined as unknown as Map<string, { count: number; lastReset: number }>

// ==================== TOKEN SIGNING ====================

const TOKEN_SECRET = (() => {
  const secret = env.TOKEN_SECRET
  if (!secret) {
    // During build phase, env vars may not be available — return placeholder
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return 'build-placeholder-not-for-production-use'
    }
    // SECURITY: Do NOT use a fallback secret in production.
    // If TOKEN_SECRET is missing, token verification will fail (not succeed with a known secret).
    // This prevents token forgery attacks.
    console.error('[FATAL] TOKEN_SECRET environment variable must be set. Auth tokens will not validate correctly.')
    // Return a random string that changes every server start — tokens signed with this
    // won't validate on subsequent starts, effectively disabling the bearer token auth path.
    // Users will need to re-login. This is safer than a hardcoded placeholder.
    return crypto.randomBytes(32).toString('hex')
  }
  return secret
})()
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

// Token rotation threshold: if a token is older than this, issue a fresh one.
// This limits the window of opportunity for stolen cookies (especially Remember Me)
// without requiring users to re-authenticate frequently.
const TOKEN_ROTATION_THRESHOLD = 60 * 60 * 1000 // 1 hour

/**
 * Generate an HMAC-signed auth token.
 * Format: base64(userId:tokenVersion:timestamp:hmacSignature)
 * This prevents token forgery - without the secret, attackers cannot create valid tokens.
 * tokenVersion is included so that sessions can be invalidated when the user changes their password.
 */
export function generateAuthToken(userId: string, tokenVersion: number = 0): string {
  const timestamp = Date.now().toString()
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${userId}:${tokenVersion}:${timestamp}`)
    .digest('hex')
  const payload = `${userId}:${tokenVersion}:${timestamp}:${signature}`
  return Buffer.from(payload).toString('base64')
}

/**
 * Verify an HMAC-signed auth token.
 * Returns { userId, tokenVersion } if valid, null otherwise.
 * The caller should check that the tokenVersion matches the user's current tokenVersion in the DB.
 * If they don't match, the token was issued before a password change and should be rejected.
 */
export function verifyAuthToken(token: string): { userId: string; tokenVersion: number; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const parts = decoded.split(':')

    // Support both old format (userId:timestamp:signature) and new format (userId:tokenVersion:timestamp:signature)
    let userId: string, tokenVersion: string, timestamp: string, signature: string

    if (parts.length === 3) {
      // Old format: userId:timestamp:signature (tokenVersion = 0)
      ;[userId, timestamp, signature] = parts
      tokenVersion = '0'
    } else if (parts.length === 4) {
      // New format: userId:tokenVersion:timestamp:signature
      ;[userId, tokenVersion, timestamp, signature] = parts
    } else {
      return null
    }

    if (!userId || !timestamp || !signature) return null

    // Check token expiry
    const tokenAge = Date.now() - parseInt(timestamp)
    if (tokenAge <= 0 || tokenAge > TOKEN_EXPIRY) return null

    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(`${userId}:${tokenVersion}:${timestamp}`)
      .digest('hex')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      // Try old format signature for backward compatibility during migration
      const oldExpectedSignature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(`${userId}:${timestamp}`)
        .digest('hex')
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(oldExpectedSignature))) {
        return null
      }
      // Old format signature matched — return with tokenVersion 0
      return { userId, tokenVersion: 0, timestamp: parseInt(timestamp) || 0 }
    }

    return { userId, tokenVersion: parseInt(tokenVersion) || 0, timestamp: parseInt(timestamp) || 0 }
  } catch {
    return null
  }
}

// ==================== SESSION VERIFICATION ====================

export interface AuthResult {
  success: true
  user: {
    id: string
    email: string
    name: string
    role: string
    isVerified: boolean
    isActive: boolean
    tokenVersion: number
  }
  /** If the token is older than TOKEN_ROTATION_THRESHOLD, a new token should be issued.
   * This enables token rotation for Remember Me sessions without short session expiry. */
  shouldRotateToken?: boolean
}

export interface AuthError {
  success: false
  error: string
  status: number
}

/**
 * Verify that the request comes from an authenticated user.
 * SECURITY: Three methods are accepted:
 * 1. NextAuth session (for Google OAuth users)
 * 2. HMAC-signed session cookie (for email/password users — sticky login)
 * 3. HMAC-signed bearer token (fallback for API clients)
 * 
 * REMOVED: x-auth-user-id header method (was a critical security vulnerability)
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult | AuthError> {
  try {
    // Method 1: Check NextAuth session (for Google OAuth)
    const session = await getServerSession(authOptions)
    if (session?.user) {
      const userEmail = (session.user as any).email
      if (userEmail) {
        const dbUser = await db.user.findUnique({
          where: { email: userEmail },
          select: { id: true, email: true, name: true, role: true, isVerified: true, isActive: true, tokenVersion: true },
        })
        if (dbUser && dbUser.isActive) {
          return { success: true, user: dbUser }
        }
      }
    }
  } catch {
    // NextAuth session check failed, try other methods
  }

  // Method 2: Check HMAC-signed session cookie (sticky login — primary method)
  // Session cookies are httpOnly, sent automatically by the browser, and cleared on browser close
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (sessionCookie) {
    const tokenResult = verifyAuthToken(sessionCookie)
    if (tokenResult) {
      const dbUser = await db.user.findUnique({
        where: { id: tokenResult.userId },
        select: { id: true, email: true, name: true, role: true, isVerified: true, isActive: true, tokenVersion: true },
      })
      if (dbUser && dbUser.isActive) {
        // SECURITY: Check tokenVersion to invalidate sessions after password change
        if (tokenResult.tokenVersion !== dbUser.tokenVersion) {
          // Token was issued before password change — reject it
          return { success: false, error: 'Sesi telah berakhir. Silakan login kembali.', status: 401 }
        }
        // Token rotation: if the token is older than the threshold, flag for rotation
        const tokenAge = Date.now() - tokenResult.timestamp
        const shouldRotate = tokenAge > TOKEN_ROTATION_THRESHOLD
        return { success: true, user: dbUser, shouldRotateToken: shouldRotate }
      }
    }
  }

  // Method 3: Check HMAC-signed bearer token (fallback for API clients)
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.replace(/^bearer\s+/i, '')
  if (bearerToken) {
    const tokenResult = verifyAuthToken(bearerToken)
    if (tokenResult) {
      const dbUser = await db.user.findUnique({
        where: { id: tokenResult.userId },
        select: { id: true, email: true, name: true, role: true, isVerified: true, isActive: true, tokenVersion: true },
      })
      if (dbUser && dbUser.isActive) {
        // SECURITY: Check tokenVersion to invalidate sessions after password change
        if (tokenResult.tokenVersion !== dbUser.tokenVersion) {
          return { success: false, error: 'Sesi telah berakhir. Silakan login kembali.', status: 401 }
        }
        return { success: true, user: dbUser }
      }
    }
  }

  return { success: false, error: 'Belum terautentikasi. Silakan login terlebih dahulu.', status: 401 }
}

// ==================== ROLE CHECK HELPERS ====================

/**
 * Check if a user is a Super Admin (role='admin' + specific email).
 */
export function isSuperAdmin(role: string, email: string): boolean {
  return role === 'admin' && email === env.SUPER_ADMIN_EMAIL
}

/**
 * Check if a user is a Manager.
 */
export function isManager(role: string): boolean {
  return role === 'manager'
}

/**
 * Check if a user has any elevated role (admin, manager, or division staff).
 */
export function isElevatedRole(role: string): boolean {
  return (ELEVATED_ROLES as readonly string[]).includes(role)
}

// ==================== ROLE-LEVEL VERIFICATION ====================

/**
 * Verify that the request comes from an admin user.
 * Includes: admin, manager, and all division roles.
 * This is the base check for any admin panel access.
 */
export async function verifyAdmin(request: NextRequest): Promise<AuthResult | AuthError> {
  const authResult = await verifyAuth(request)

  if (!authResult.success) return authResult

  // Admin panel access: admin, manager, and all division roles
  const adminRoles = ['admin', 'manager', ...DIVISION_ROLES]
  if (!adminRoles.includes(authResult.user.role)) {
    return { success: false, error: 'Akses ditolak. Diperlukan akses admin.', status: 403 }
  }

  return authResult
}

/**
 * Verify that the request comes from a Manager or Super Admin.
 * Managers can manage divisions, promote to division admins, but NOT to manager/super admin.
 */
export async function verifyManager(request: NextRequest): Promise<AuthResult | AuthError> {
  const authResult = await verifyAuth(request)

  if (!authResult.success) return authResult

  // Manager or Super Admin only
  const isSuperAdminUser = isSuperAdmin(authResult.user.role, authResult.user.email)
  const isManagerUser = isManager(authResult.user.role)

  if (!isSuperAdminUser && !isManagerUser) {
    return { success: false, error: 'Akses ditolak. Diperlukan akses Manager atau Super Admin.', status: 403 }
  }

  return authResult
}

/**
 * Verify that the request comes from a super admin user.
 * Super admin is the primary admin identified by email (from env.SUPER_ADMIN_EMAIL).
 * Only super admin can promote users to manager or remove admin roles.
 */
export async function verifySuperAdmin(request: NextRequest): Promise<AuthResult | AuthError> {
  const authResult = await verifyAuth(request)

  if (!authResult.success) return authResult

  // Super admin must have role 'admin' AND specific email
  if (!isSuperAdmin(authResult.user.role, authResult.user.email)) {
    return { success: false, error: 'Akses ditolak. Diperlukan akses Super Admin.', status: 403 }
  }

  return authResult
}

/**
 * Verify that the request comes from an admin or staff user.
 * Includes all elevated roles: admin, manager, and division staff.
 */
export async function verifyStaff(request: NextRequest): Promise<AuthResult | AuthError> {
  const authResult = await verifyAuth(request)

  if (!authResult.success) return authResult

  if (!isElevatedRole(authResult.user.role)) {
    return { success: false, error: 'Akses ditolak. Diperlukan akses staf.', status: 403 }
  }

  return authResult
}

/**
 * Helper to return a standardized error response
 */
export function authErrorResponse(authError: AuthError): NextResponse {
  return NextResponse.json(
    { success: false, error: authError.error },
    { status: authError.status }
  )
}
