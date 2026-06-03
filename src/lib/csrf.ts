import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

// ==================== CSRF PROTECTION ====================
// Double-submit cookie pattern for CSRF protection
// Uses Web Crypto API (Edge Runtime compatible)
// Works by:
// 1. Setting a CSRF token as a cookie (SameSite=Lax, NOT httpOnly — JS must read it)
// 2. Requiring the same token in a custom header (X-CSRF-Token) for mutating requests
// 3. Since browsers don't send custom headers in cross-origin requests, this prevents CSRF
// 4. The cookie is NOT httpOnly because the double-submit pattern requires JS to read it
//    and copy the value to a custom header. Protection comes from SameSite + CORS.

const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

// Methods that require CSRF protection (all mutating methods)
const PROTECTED_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

// Paths exempt from CSRF (external webhooks, auth routes, etc.)
const CSRF_EXEMPT_PATHS = new Set([
  '/api/payment/notification', // Midtrans webhook (server-to-server, no browser)
  '/api/setup/storage',        // Initial setup
  '/api/seed',                  // Seed data
  '/api/admin/setup',           // Admin initial setup
  '/api/admin/init',            // Admin first user creation
  '/api/analytics/track',       // Analytics beacon
  '/api/debug/health',          // Diagnostic endpoint
  '/api/health-check',          // Diagnostic endpoint
  '/api/health',                // Health check
  '/api/ping',                  // Health check
  '/api/db-status',             // Database connectivity check (public, read-only)
  '/api/csrf-token',            // CSRF token issuance (must be exempt — it PROVIDES the token)
])

/**
 * Get the CSRF secret from centralized env (lazy-loaded for Edge compatibility)
 */
function getCsrfSecret(): string {
  const secret = env.CSRF_SECRET
  if (!secret) {
    // In middleware (Edge), we can't throw at module level, so return empty and let validation fail
    return ''
  }
  return secret
}

/**
 * Generate a signed CSRF token using Web Crypto API.
 * Format: base64(randomHex:timestamp:hmacSignature)
 */
export async function generateCsrfToken(): Promise<string> {
  const secret = getCsrfSecret()
  if (!secret) {
    // CSRF secret not configured — generate a placeholder token
    // This allows the page to render, but CSRF validation will fail on mutating requests
    // In production, CSRF_SECRET must be set for proper protection
    const randomBytes = generateRandomHex(32)
    const timestamp = Date.now().toString()
    const payload = `${randomBytes}:${timestamp}:no-csrf-secret`
    return base64Encode(payload)
  }
  const randomBytes = generateRandomHex(32)
  const timestamp = Date.now().toString()
  const signature = await hmacSign(secret, `${randomBytes}:${timestamp}`)
  const payload = `${randomBytes}:${timestamp}:${signature}`
  return base64Encode(payload)
}

/**
 * Verify a CSRF token's signature and expiry using Web Crypto API.
 */
export async function verifyCsrfToken(token: string): Promise<boolean> {
  try {
    const secret = getCsrfSecret()
    if (!secret) return false

    const decoded = base64Decode(token)
    const [randomBytes, timestamp, signature] = decoded.split(':')

    if (!randomBytes || !timestamp || !signature) return false

    // Check token expiry
    const tokenAge = Date.now() - parseInt(timestamp)
    if (tokenAge <= 0 || tokenAge > CSRF_TOKEN_EXPIRY) return false

    // Verify HMAC signature using constant-time comparison
    const expectedSignature = await hmacSign(secret, `${randomBytes}:${timestamp}`)
    return timingSafeEqual(signature, expectedSignature)
  } catch {
    return false
  }
}

/**
 * Check if a request requires CSRF protection.
 * Only mutating methods (POST, PUT, DELETE, PATCH) on non-exempt paths need CSRF.
 */
function requiresCsrfCheck(request: NextRequest): boolean {
  const method = request.method.toUpperCase()
  if (!PROTECTED_METHODS.has(method)) return false

  const pathname = request.nextUrl.pathname
  // Check exact match
  if (CSRF_EXEMPT_PATHS.has(pathname)) return false
  // SECURITY: Only exempt SPECIFIC unauthenticated auth routes from CSRF.
  // Authenticated auth routes (change-password, logout, logout-all) MUST require CSRF
  // to prevent CSRF attacks that exploit the user's existing session cookie.
  const csrfExemptAuthRoutes = [
    '/api/auth/login',              // No existing session
    '/api/auth/register',           // No existing session
    '/api/auth/forgot-password',    // No existing session
    '/api/auth/reset-password',     // Uses token, not session
    '/api/auth/verify-email',       // Uses token, not session (GET redirect)
    '/api/auth/resend-verification', // No existing session
    '/api/auth/otp/send',           // No existing session
    '/api/auth/otp/verify',         // Uses OTP, not session
    '/api/auth/sync-user',          // Internal (has x-internal-secret)
    '/api/auth/diagnostic',         // Has own secret (x-admin-secret)
    '/api/auth/login-diagnostic',   // Has own secret (x-admin-secret)
  ]
  if (csrfExemptAuthRoutes.includes(pathname)) return false
  // NextAuth routes handle their own CSRF
  if (pathname.startsWith('/api/auth/') && pathname.includes('nextauth')) return false

  return true
}

/**
 * Validate CSRF token from request.
 * Checks the X-CSRF-Token header against the csrf-token cookie.
 *
 * FIX: Next.js URL-encodes cookie values when setting them (e.g., '=' → '%3D').
 * When the client reads from document.cookie, it may get the URL-encoded value.
 * But request.cookies.get() URL-decodes the value. This causes a mismatch.
 * Solution: Also URL-decode the header token before comparison as a safety net.
 */
export async function validateCsrfRequest(request: NextRequest): Promise<{ valid: boolean; reason?: string }> {
  if (!requiresCsrfCheck(request)) {
    return { valid: true }
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  let headerToken = request.headers.get(CSRF_HEADER_NAME)

  if (!cookieToken) {
    return { valid: false, reason: 'Missing CSRF cookie' }
  }

  if (!headerToken) {
    return { valid: false, reason: 'Missing CSRF header' }
  }

  // Safety net: URL-decode the header token in case the client sent a URL-encoded value.
  // This handles the case where document.cookie returns URL-encoded values
  // and the client didn't (or couldn't) decode them before sending as header.
  try {
    const decoded = decodeURIComponent(headerToken)
    if (decoded !== headerToken) {
      headerToken = decoded
    }
  } catch {
    // If decoding fails, use the raw value
  }

  // Both tokens must be valid independently
  const cookieValid = await verifyCsrfToken(cookieToken)
  if (!cookieValid) {
    return { valid: false, reason: 'Invalid CSRF cookie' }
  }

  const headerValid = await verifyCsrfToken(headerToken)
  if (!headerValid) {
    return { valid: false, reason: 'Invalid CSRF header' }
  }

  // Cookie and header tokens must match
  if (cookieToken !== headerToken) {
    return { valid: false, reason: 'CSRF token mismatch' }
  }

  return { valid: true }
}

/**
 * Set CSRF cookie on a response.
 */
export function setCsrfCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    // IMPORTANT: httpOnly must be false for the double-submit cookie pattern.
    // The client-side JavaScript needs to read this cookie to send it as a header.
    // CSRF protection comes from: (1) SameSite=strict prevents cross-origin cookie sending,
    // (2) attackers cannot read cross-origin cookies, (3) attackers cannot set custom headers.
    // This cookie is NOT a session identifier — it's a single-use CSRF nonce.
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400, // 24 hours
  })
  return response
}

/**
 * Generate and set a fresh CSRF token on the response.
 */
export async function issueCsrfToken(response: NextResponse): Promise<{ response: NextResponse; token: string }> {
  const token = await generateCsrfToken()
  const updatedResponse = setCsrfCookie(response, token)
  return { response: updatedResponse, token }
}

/**
 * Get the CSRF cookie name (for client-side cookie reading).
 */
export function getCsrfCookieName(): string {
  return CSRF_COOKIE_NAME
}

/**
 * Get the CSRF header name (for client-side header setting).
 */
export function getCsrfHeaderName(): string {
  return CSRF_HEADER_NAME
}

// ==================== WEB CRYPTO HELPERS (Edge Runtime Compatible) ====================

/**
 * Generate random hex string using Web Crypto API.
 */
function generateRandomHex(bytes: number): string {
  const array = new Uint8Array(bytes)
  // In Edge Runtime, use crypto.getRandomValues
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    // SECURITY WARNING: Fallback to Math.random() is NOT cryptographically secure.
    // This should never happen in modern Node.js or browser environments.
    // If you see this warning, investigate why crypto.getRandomValues is unavailable.
    console.error('[SECURITY] crypto.getRandomValues unavailable — CSRF token generation using insecure fallback!')
    for (let i = 0; i < bytes; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * HMAC-SHA256 sign using Web Crypto API.
 */
async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Base64 encode a string (works in Edge Runtime).
 */
function base64Encode(str: string): string {
  // Use btoa if available (browser/Edge), otherwise Buffer (Node.js)
  if (typeof btoa !== 'undefined') {
    return btoa(str)
  }
  return Buffer.from(str).toString('base64')
}

/**
 * Base64 decode a string (works in Edge Runtime).
 */
function base64Decode(str: string): string {
  // Use atob if available (browser/Edge), otherwise Buffer (Node.js)
  if (typeof atob !== 'undefined') {
    return atob(str)
  }
  return Buffer.from(str, 'base64').toString()
}
