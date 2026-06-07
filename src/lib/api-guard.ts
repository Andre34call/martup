// ==================== UNIFIED API GUARD ====================
// Single function that handles all common API route concerns:
// 1. Auth verification (none/user/admin/manager/superadmin/staff)
// 2. Rate limiting (config or pre-created limiter)
// 3. Zod body validation
// 4. CSRF verification (for mutating methods)
//
// Eliminates the repetitive boilerplate found in every API route where
// the same auth → rate-limit → validate → business-logic pattern is copy-pasted.
//
// Usage (manual guard):
// ```ts
// export async function POST(request: NextRequest) {
//   const guard = await apiGuard(request, {
//     auth: 'user',
//     rateLimit: { windowMs: 60_000, maxRequests: 10 },
//     schema: myZodSchema,
//   })
//   if (guard instanceof NextResponse) return guard
//
//   const { user, body } = guard
//   // ... business logic
// }
// ```
//
// Usage (createHandler wrapper):
// ```ts
// export const POST = createHandler({
//   auth: 'user',
//   rateLimit: { windowMs: 60_000, maxRequests: 10 },
//   schema: createCartSchema,
// }, async (request, { user, body }) => {
//   // Business logic here
//   return successResponse(result)
// })
// ```

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  verifyAuth,
  verifyAdmin,
  verifySuperAdmin,
  verifyManager,
  verifyStaff,
  authErrorResponse,
  type AuthResult,
  type AuthError,
} from '@/lib/auth-middleware'
import {
  createRateLimiter,
  type RateLimiterConfig,
  type RateLimitResult,
} from '@/lib/rate-limit'
import { validateBody } from '@/lib/validations'
import { validateCsrfRequest } from '@/lib/csrf'
import { successResponse, errorResponse, parseRequestBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

// ==================== TYPE DEFINITIONS ====================

/** Auth level required for the route. 'none' = skip auth check entirely. */
export type AuthLevel = 'none' | 'user' | 'admin' | 'manager' | 'superadmin' | 'staff'

/**
 * A pre-created rate limiter instance (returned by `createRateLimiter`).
 * We define this interface so callers don't need to import `createRateLimiter`
 * just for the type.
 */
export interface RateLimiterInstance {
  check: (identifier: string) => Promise<RateLimitResult>
  reset: (identifier: string) => Promise<void>
}

/** Guard configuration — all fields are optional. */
export interface GuardConfig {
  /** Auth level required. Default: 'user' */
  auth?: AuthLevel
  /**
   * Rate limiter config or pre-created limiter instance.
   * - Pass a `RateLimiterConfig` object to create a new limiter on the fly.
   * - Pass a pre-created limiter (e.g. `apiLimiter`, `paymentLimiter`) to reuse one.
   */
  rateLimit?: RateLimiterConfig | RateLimiterInstance
  /** Zod schema for request body validation. If omitted, body is not parsed. */
  schema?: z.ZodTypeAny
  /**
   * Whether to verify CSRF for mutating methods (POST/PUT/DELETE/PATCH).
   * Default: true. Set to false for webhook endpoints or exempt routes.
   */
  csrf?: boolean
  /**
   * Custom identifier for rate limiting.
   * Default: user ID (if authenticated) or client IP.
   */
  rateLimitKey?: string
}

/**
 * Successful guard result — contains the authenticated user (if any)
 * and the validated body (if a schema was provided).
 */
export interface GuardResult<T = unknown> {
  /** Authenticated user, if auth was required and succeeded. null when auth='none'. */
  user: AuthResult['user'] | null
  /** Validated body, if a schema was provided. null when no schema. */
  body: T | null
  /** Client IP address extracted from request headers. */
  clientIp: string
}

// ==================== MAIN GUARD FUNCTION ====================

/**
 * Single function that handles all common API concerns.
 *
 * Processing order:
 * 1. CSRF verification (for mutating methods, if enabled)
 * 2. Auth verification (according to auth level)
 * 3. Rate limiting (if configured)
 * 4. Body parsing + Zod validation (if schema provided)
 *
 * Returns `GuardResult<T>` on success, or a `NextResponse` error on failure.
 * The caller should check `if (guard instanceof NextResponse) return guard`
 * before accessing `guard.user` and `guard.body`.
 */
export async function apiGuard<T = unknown>(
  request: NextRequest,
  config: GuardConfig = {},
): Promise<GuardResult<T> | NextResponse> {
  const {
    auth = 'user',
    rateLimit,
    schema,
    csrf = true,
  } = config

  // ---------- 1. CSRF verification (for mutating methods) ----------
  if (csrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      logger.warn(
        {
          component: 'api-guard',
          method: request.method,
          path: request.nextUrl.pathname,
          reason: csrfResult.reason,
        },
        'CSRF validation failed',
      )
      return errorResponse(csrfResult.reason || 'CSRF validation failed', 403)
    }
  }

  // ---------- 2. Auth verification ----------
  let user: AuthResult['user'] | null = null

  if (auth !== 'none') {
    let authResult: AuthResult | AuthError

    switch (auth) {
      case 'admin':
        authResult = await verifyAdmin(request)
        break
      case 'manager':
        authResult = await verifyManager(request)
        break
      case 'superadmin':
        authResult = await verifySuperAdmin(request)
        break
      case 'staff':
        authResult = await verifyStaff(request)
        break
      default:
        // 'user' — standard authenticated user
        authResult = await verifyAuth(request)
        break
    }

    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    user = authResult.user
  }

  // ---------- 3. Rate limiting ----------
  if (rateLimit) {
    // Distinguish between a config object and a pre-created limiter instance.
    // A pre-created limiter has a `check` method; a config object does not.
    const limiter: RateLimiterInstance = 'check' in rateLimit
      ? (rateLimit as RateLimiterInstance)
      : createRateLimiter(rateLimit as RateLimiterConfig)

    const identifier = config.rateLimitKey || user?.id || getClientIp(request)
    const result = await limiter.check(identifier)

    if (!result.allowed) {
      const retrySeconds = Math.ceil((result.resetAt - Date.now()) / 1000)
      const retryMessage =
        retrySeconds > 60
          ? `${Math.ceil(retrySeconds / 60)} menit`
          : `${retrySeconds} detik`

      logger.warn(
        {
          component: 'api-guard',
          method: request.method,
          path: request.nextUrl.pathname,
          identifier,
          remaining: result.remaining,
          resetAt: result.resetAt,
        },
        'Rate limit exceeded',
      )

      return errorResponse(
        `Terlalu banyak permintaan. Coba lagi dalam ${retryMessage}.`,
        429,
      )
    }
  }

  // ---------- 4. Body parsing + Zod validation ----------
  let body: T | null = null

  if (schema) {
    const parsed = await parseRequestBody<T>(request)
    if (parsed instanceof NextResponse) return parsed

    const validation = validateBody(schema, parsed)
    if (!validation.success) {
      return errorResponse(validation.error, 422)
    }
    body = validation.data
  }

  // ---------- Success ----------
  return {
    user,
    body,
    clientIp: getClientIp(request),
  }
}

// ==================== HELPER: CLIENT IP ====================

/**
 * Extract client IP from request headers.
 * Checks X-Forwarded-For first (standard proxy header), then X-Real-IP.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // X-Forwarded-For may contain a comma-separated list; return the first (original client)
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

// ==================== CONVENIENCE WRAPPER ====================

/**
 * Create a full API route handler with the guard built in.
 *
 * Wraps `apiGuard` + error handling so the handler only needs to contain
 * business logic.
 *
 * Usage:
 * ```ts
 * export const POST = createHandler({
 *   auth: 'user',
 *   rateLimit: { windowMs: 60_000, maxRequests: 10 },
 *   schema: createCartSchema,
 * }, async (request, { user, body }) => {
 *   // Business logic here — guard has already verified auth, rate limit, body
 *   return successResponse(result)
 * })
 * ```
 */
export function createHandler<T = unknown>(
  config: GuardConfig,
  handler: (request: NextRequest, guard: GuardResult<T>) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    try {
      const guard = await apiGuard<T>(request, config)
      if (guard instanceof NextResponse) return guard
      return await handler(request, guard)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      logger.error(
        {
          err: error,
          method: request.method,
          path: new URL(request.url).pathname,
        },
        'API Error (createHandler)',
      )
      return errorResponse(message, 500)
    }
  }
}
