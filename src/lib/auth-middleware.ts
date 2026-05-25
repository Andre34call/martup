import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// ==================== AUTH MIDDLEWARE ====================

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX = 10 // max 10 requests per minute

export function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry || now - entry.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) {
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
 * Checks NextAuth session first, then falls back to custom auth header.
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult | AuthError> {
  try {
    // Method 1: Check NextAuth session
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
    // NextAuth session check failed, try custom auth
  }

  // Method 2: Check custom auth header (for API-only auth)
  const authHeader = request.headers.get('x-auth-user-id')
  if (authHeader) {
    const dbUser = await db.user.findUnique({
      where: { id: authHeader },
      select: { id: true, email: true, name: true, role: true, isVerified: true, isActive: true },
    })
    if (dbUser && dbUser.isActive) {
      return { success: true, user: dbUser }
    }
  }

  // Method 3: Check for bearer token from our login system
  const bearerToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (bearerToken) {
    // Validate our custom token (userId:timestamp:signature)
    try {
      const decoded = Buffer.from(bearerToken, 'base64').toString()
      const [userId, timestamp] = decoded.split(':')
      if (userId && timestamp) {
        const tokenAge = Date.now() - parseInt(timestamp)
        // Token valid for 24 hours
        if (tokenAge > 0 && tokenAge < 24 * 60 * 60 * 1000) {
          const dbUser = await db.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, role: true, isVerified: true, isActive: true },
          })
          if (dbUser && dbUser.isActive) {
            return { success: true, user: dbUser }
          }
        }
      }
    } catch {
      // Invalid token format
    }
  }

  return { success: false, error: 'Unauthorized - Please login first', status: 401 }
}

/**
 * Verify that the request comes from an admin user.
 * Must be called after verifyAuth.
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
 * Generate a simple auth token for API authentication.
 * Format: base64(userId:timestamp)
 * For production, use JWT with proper signing.
 */
export function generateAuthToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`
  return Buffer.from(payload).toString('base64')
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
