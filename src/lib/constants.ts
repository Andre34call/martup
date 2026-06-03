/**
 * Application-wide constants
 * Centralizes magic numbers and strings used across the codebase.
 * Each constant can be overridden via environment variables where appropriate.
 */

// ==================== AUTH & SECURITY ====================

/** Auth token expiry: 24 hours */
export const TOKEN_EXPIRY = 24 * 60 * 60 * 1000

/** Token rotation threshold: 1 hour — tokens older than this get refreshed */
export const TOKEN_ROTATION_THRESHOLD = 60 * 60 * 1000

/** Remember Me cookie duration: 30 days */
export const REMEMBER_ME_MAX_AGE = 30 * 24 * 60 * 60 // seconds

/** CSRF token expiry: 24 hours */
export const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000

/** Maximum failed login attempts before account lockout */
export const MAX_FAILED_LOGIN_ATTEMPTS = 10

/** Account lockout duration in minutes */
export const LOCKOUT_DURATION_MINUTES = 30

// ==================== OTP ====================

/** OTP code length */
export const OTP_LENGTH = 6

/** OTP expiry time in minutes */
export const OTP_EXPIRY_MINUTES = 5

/** Maximum OTP verification attempts before code is invalidated */
export const MAX_OTP_ATTEMPTS = 5

/** Maximum OTP send requests per phone per hour */
export const OTP_MAX_SEND_PER_HOUR = 5

// ==================== FINANCIAL LIMITS ====================

/** Minimum deposit/topup amount (Rp) */
export const MIN_DEPOSIT_AMOUNT = 10_000

/** Maximum deposit/topup amount (Rp) */
export const MAX_DEPOSIT_AMOUNT = 10_000_000

/** Minimum withdrawal amount (Rp) */
export const MIN_WITHDRAWAL_AMOUNT = 10_000

/** Maximum withdrawal amount (Rp) */
export const MAX_WITHDRAWAL_AMOUNT = 10_000_000

// ==================== PLATFORM FEES ====================

/** Default platform fee rate (3%) — can be overridden in PlatformSetting */
export const PLATFORM_FEE_RATE = 0.03

/** Default seller commission rate (5%) — stored in Seller.commissionRate */
export const DEFAULT_COMMISSION_RATE = 0.05

// ==================== ORDER ====================

/** Days before auto-completing a service order */
export const AUTO_COMPLETE_DAYS = 7

/** Days before auto-confirming buyer receipt for service orders */
export const AUTO_CONFIRM_DAYS = 3

// ==================== PAGINATION ====================

/** Default page size for list endpoints */
export const DEFAULT_PAGE_SIZE = 20

/** Maximum page size for list endpoints */
export const MAX_PAGE_SIZE = 50
