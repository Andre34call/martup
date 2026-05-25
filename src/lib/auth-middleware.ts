import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import crypto from 'crypto'

// ==================== AUTH MIDDLEWARE ====================
// SECURITY OVERHAUL: Removed insecure x-auth-user-id method
// Only NextAuth session and HMAC-signed bearer tokens are accepted

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 10 // max 10 requests per minute

export function checkRateLimit(identifier: string, maxRequests: number = RATE_LIMIT_MAX): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry || now - entry.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.lastReset > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(key)
    }
  }
}, 5 * 60 * 1000)

// ==================== TOKEN SIGNING ====================

const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.NEXTAUTH_SECRET || (() => {
  console.warn('[SECURITY] WARNING: Using fallback TOKEN_SECRET. Set TOKEN_SECRET or NEXTAUTH_SECRET environment variable in production!')
  return 'fallback-dev-only-secret'
})()
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Generate an HMAC-signed auth token.
 * Format: base64(userId:timestamp:hmacSignature)
 * This prevents token forgery - without the secret, attackers cannot create valid tokens.
 */
export function generateAuthToken(userId: string): string {
  const timestamp = Date.now().toString()
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${userId}:${timestamp}`)
    .digest('hex')
  const payload = `${userId}:${timestamp}:${signature}`
  return Buffer.from(payload).toString('base64')
}

/**
 * Verify an HMAC-signed auth token.
 * Returns the userId if valid, null otherwise.
 */
export function verifyAuthToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const [userId, timestamp, signature] = decoded.split(':')

    if (!userId || !timestamp || !signature) return null

    // Check token expiry
    const tokenAge = Date.now() - parseInt(timestamp)
    if (tokenAge <= 0 || tokenAge > TOKEN_EXPIRY) return null

    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(`${userId}:${timestamp}`)
      .digest('hex')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null
    }

    return userId
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
  }
}

export interface AuthError {
  success: false
  error: string
  status: number
}

/**
 * Verify that the request comes from an authenticated user.
 * SECURITY: Only two methods are accepted:
 * 1. NextAuth session (for Google OAuth users)
 * 2. HMAC-signed bearer token (for email/password users)
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
          select: { id: true, email: true, name: true, role: true, isVerified: true, isActive: true },
        })
        if (dbUser && dbUser.isActive) {
          return { success: true, user: dbUser }
        }
      }
    }
  } catch {
    // NextAuth session check failed, try bearer token
  }

  // Method 2: Check HMAC-signed bearer token (for email/password login)
  const bearerToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (bearerToken) {
    const userId = verifyAuthToken(bearerToken)
    if (userId) {
      const dbUser = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, role: true, isVerified: true, isActive: true },
      })
      if (dbUser && dbUser.isActive) {
        return { success: true, user: dbUser }
      }
    }
  }

  return { success: false, error: 'Unauthorized - Please login first', status: 401 }
}

/**
 * Verify that the request comes from an admin user.
 */
export async function verifyAdmin(request: NextRequest): Promise<AuthResult | AuthError> {
  const authResult = await verifyAuth(request)

  if (!authResult.success) return authResult

  const adminRoles = ['admin']
  if (!adminRoles.includes(authResult.user.role)) {
    return { success: false, error: 'Forbidden - Admin access required', status: 403 }
  }

  return authResult
}

/**
 * Verify that the request comes from an admin or staff user.
 */
export async function verifyStaff(request: NextRequest): Promise<AuthResult | AuthError> {
  const authResult = await verifyAuth(request)

  if (!authResult.success) return authResult

  const staffRoles = ['admin', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr']
  if (!staffRoles.includes(authResult.user.role)) {
    return { success: false, error: 'Forbidden - Staff access required', status: 403 }
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
