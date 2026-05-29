// ==================== SECURE TOKEN & OTP HASHING ====================
// All sensitive tokens (email verification, password reset, OTP codes)
// must be HASHED before storing in the database.
// This prevents attackers who gain DB access from using stored tokens directly.

import crypto from 'crypto'

// Use the same TOKEN_SECRET as auth-middleware for HMAC-based hashing
// This ensures that even if the DB is compromised, tokens cannot be used
// without also having the application secret.

function getHashSecret(): string {
  // Use NEXTAUTH_SECRET as the hashing key (same as TOKEN_SECRET fallback)
  const secret = process.env.TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    // During build phase, return a placeholder
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return 'build-placeholder-not-for-production-use'
    }
    // In production without a secret, use a random key that changes per server start
    // This effectively invalidates all tokens on restart, forcing re-authentication
    console.error('[FATAL] TOKEN_SECRET/NEXTAUTH_SECRET not set — token hashing will not persist across restarts')
    return crypto.randomBytes(32).toString('hex')
  }
  return secret
}

// Cache the secret at module level (same pattern as auth-middleware)
let _hashSecret: string | null = null
function hashSecret(): string {
  if (!_hashSecret) {
    _hashSecret = getHashSecret()
  }
  return _hashSecret
}

/**
 * Hash a sensitive token for secure storage in the database.
 * Uses HMAC-SHA256 with the application secret.
 * 
 * Use this for: email verification tokens, password reset tokens, OTP codes
 * 
 * @param token - The plaintext token to hash (e.g., crypto.randomBytes(32).toString('hex') or a 6-digit OTP)
 * @returns Hex-encoded HMAC-SHA256 hash
 */
export function hashToken(token: string): string {
  return crypto
    .createHmac('sha256', hashSecret())
    .update(token)
    .digest('hex')
}

/**
 * Verify a plaintext token against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 * 
 * @param token - The plaintext token to verify (from user input)
 * @param storedHash - The HMAC hash stored in the database
 * @returns true if the token matches the hash
 */
export function verifyTokenHash(token: string, storedHash: string): boolean {
  const expectedHash = hashToken(token)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    )
  } catch {
    return false
  }
}

/**
 * Hash an OTP code for secure storage.
 * Same as hashToken but named explicitly for OTP use cases.
 * 
 * @param otpCode - The plaintext OTP code (e.g., '123456')
 * @returns Hex-encoded HMAC-SHA256 hash
 */
export function hashOtp(otpCode: string): string {
  return hashToken(otpCode)
}

/**
 * Verify an OTP code against a stored hash.
 * Same as verifyTokenHash but named explicitly for OTP use cases.
 * 
 * @param otpCode - The plaintext OTP code from user input
 * @param storedHash - The HMAC hash stored in the database
 * @returns true if the OTP matches the hash
 */
export function verifyOtpHash(otpCode: string, storedHash: string): boolean {
  return verifyTokenHash(otpCode, storedHash)
}
