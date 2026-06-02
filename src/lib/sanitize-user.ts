/**
 * User Data Sanitization
 * 
 * SECURITY: Ensures sensitive fields are never exposed in API responses.
 * The old pattern of `const { password: _, ...rest } = user` was insufficient
 * because it still exposed: otpCode, resetPasswordToken, emailVerificationToken,
 * tokenVersion, failedLoginAttempts, lockedUntil, fcmToken, and other sensitive data.
 */

// Fields that must NEVER be sent to the client
const SENSITIVE_USER_FIELDS = [
  'password',
  'otpCode',
  'otpExpiry',
  'resetPasswordToken',
  'resetPasswordExpiry',
  'emailVerificationToken',
  'emailVerificationExpiry',
  'failedLoginAttempts',
  'lockedUntil',
  'fcmToken',
  // tokenVersion is intentionally excluded from this list — the frontend needs it
  // to detect stale sessions (e.g., after password change on another device).
] as const

type UserWithSensitiveFields = Record<string, unknown>

/**
 * Strip sensitive fields from a user object before returning it in an API response.
 * Works with any user-like object (from Prisma include queries, etc.)
 */
export function sanitizeUser<T extends UserWithSensitiveFields>(user: T): Omit<T, typeof SENSITIVE_USER_FIELDS[number]> {
  const sanitized = { ...user }
  for (const field of SENSITIVE_USER_FIELDS) {
    delete (sanitized as Record<string, unknown>)[field]
  }
  return sanitized
}

/**
 * Strip sensitive fields from a user object that includes a seller relation.
 * Also redacts banking details from the seller object.
 */
export function sanitizeUserWithSeller<T extends UserWithSensitiveFields & { seller?: Record<string, unknown> | null }>(
  user: T
): Omit<T, typeof SENSITIVE_USER_FIELDS[number]> {
  const sanitized = sanitizeUser(user)
  
  // SECURITY: Redact banking details from seller object
  // Banking info should only be accessible via dedicated seller profile endpoints
  if (sanitized.seller) {
    const sellerCopy = { ...sanitized.seller }
    delete sellerCopy.bankAccount
    delete sellerCopy.bankHolder
    delete sellerCopy.bankName
    sanitized.seller = sellerCopy
  }
  
  return sanitized
}
