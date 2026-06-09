import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAuth, type AuthResult } from '@/lib/auth-middleware'
import { validateCsrfRequest } from '@/lib/csrf'
import { createRateLimiter, type RateLimiterConfig } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validations'
import { logger } from '@/lib/logger'

// ==================== API ROUTE GUARD ====================
// A reusable guard function that applies common checks to all API routes.
// This centralizes auth, CSRF, rate limiting, and input validation to
// prevent the same bug patterns from appearing in multiple route handlers.

/** Configuration options for the API guard */
export interface ApiGuardOptions {
  /** Require authentication — calls verifyAuth() */
  requireAuth?: boolean

  /** Validate CSRF token — calls validateCsrfRequest() for mutating methods */
  validateCsrf?: boolean

  /** Rate limit configuration — creates a rate limiter and checks it */
  rateLimit?: RateLimiterConfig & {
    /** Key suffix to use for rate limiting (defaults to user ID or IP) */
    keySuffix?: string
  }

  /** Zod schema to validate the request body against */
  schema?: z.ZodSchema<unknown>

  /**
   * Custom rate limit identifier.
   * By default, uses the authenticated user's ID, or the request IP as fallback.
   * Override this to use a different identifier (e.g., seller ID, order ID).
   */
  rateLimitIdentifier?: string

  /**
   * Whether to parse the request body as JSON.
   * Default: true when `schema` is provided, false otherwise.
   * Set to false when the route doesn't expect a JSON body.
   */
  parseBody?: boolean
}

/** Successful guard result — all checks passed */
export interface ApiGuardSuccess<T = unknown> {
  success: true
  /** Authenticated user (when requireAuth is true) */
  user: AuthResult['user'] | null
  /** Validated request body (when schema is provided) */
  data: T
  /** Parsed raw body (when parseBody is true but no schema) */
  rawBody: unknown
  /** The original NextRequest object */
  request: NextRequest
}

/** Failed guard result — one or more checks failed */
export interface ApiGuardFailure {
  success: false
  /** Pre-built NextResponse to return to the client */
  errorResponse: NextResponse
}

export type ApiGuardResult<T = unknown> = ApiGuardSuccess<T> | ApiGuardFailure

/**
 * Apply common API route guards: authentication, CSRF, rate limiting, and body validation.
 *
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const guard = await apiGuard(request, {
 *     requireAuth: true,
 *     validateCsrf: true,
 *     rateLimit: { windowMs: 60000, maxRequests: 10, keyPrefix: 'rl:products:' },
 *     schema: productCreateSchema,
 *   })
 *
 *   if (!guard.success) return guard.errorResponse
 *
 *   // guard.user — authenticated user
 *   // guard.data — validated request body
 *   // ... proceed with business logic
 * }
 * ```
 *
 * All error responses use the consistent format: `{ success: false, error: string }`
 */
export async function apiGuard<T = unknown>(
  request: NextRequest,
  options: ApiGuardOptions = {}
): Promise<ApiGuardResult<T>> {
  const {
    requireAuth = false,
    validateCsrf = false,
    rateLimit,
    schema,
    rateLimitIdentifier,
    parseBody = schema !== undefined,
  } = options

  // ==================== 1. AUTHENTICATION ====================
  let user: AuthResult['user'] | null = null

  if (requireAuth) {
    const authResult = await verifyAuth(request)

    if (!authResult.success) {
      return {
        success: false,
        errorResponse: NextResponse.json(
          { success: false, error: authResult.error },
          { status: authResult.status }
        ),
      }
    }

    user = authResult.user
  }

  // ==================== 2. CSRF VALIDATION ====================
  if (validateCsrf) {
    const method = request.method.toUpperCase()
    const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)

    if (isMutating) {
      const csrfResult = await validateCsrfRequest(request)

      if (!csrfResult.valid) {
        logger.warn(
          { component: 'api-guard', method, reason: csrfResult.reason },
          'CSRF validation failed'
        )
        return {
          success: false,
          errorResponse: NextResponse.json(
            { success: false, error: 'Validasi keamanan gagal. Silakan refresh halaman dan coba lagi.' },
            { status: 403 }
          ),
        }
      }
    }
  }

  // ==================== 3. RATE LIMITING ====================
  if (rateLimit) {
    const limiter = createRateLimiter({
      windowMs: rateLimit.windowMs,
      maxRequests: rateLimit.maxRequests,
      keyPrefix: rateLimit.keyPrefix,
    })

    // Determine the rate limit key: custom identifier > user ID > IP fallback
    let identifier: string
    if (rateLimitIdentifier) {
      identifier = rateLimitIdentifier
    } else if (user?.id) {
      identifier = user.id
    } else {
      // Fallback to IP-based rate limiting
      identifier = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'anonymous'
    }

    // Append keySuffix if provided
    if (rateLimit.keySuffix) {
      identifier = `${identifier}:${rateLimit.keySuffix}`
    }

    const rateLimitResult = await limiter.check(identifier)

    if (!rateLimitResult.allowed) {
      const retrySeconds = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
      const retryMessage = retrySeconds > 60
        ? `${Math.ceil(retrySeconds / 60)} menit`
        : `${retrySeconds} detik`

      return {
        success: false,
        errorResponse: NextResponse.json(
          { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retryMessage}.` },
          { status: 429 }
        ),
      }
    }
  }

  // ==================== 4. BODY PARSING & VALIDATION ====================
  let data: T | undefined = undefined
  let rawBody: unknown = undefined

  if (parseBody) {
    try {
      rawBody = await request.json()
    } catch {
      return {
        success: false,
        errorResponse: NextResponse.json(
          { success: false, error: 'Request body tidak valid (bukan JSON)' },
          { status: 400 }
        ),
      }
    }

    if (schema) {
      const validation = validateBody(schema, rawBody)

      if (!validation.success) {
        return {
          success: false,
          errorResponse: NextResponse.json(
            { success: false, error: validation.error },
            { status: 400 }
          ),
        }
      }

      data = validation.data as T
    }
  }

  // ==================== ALL CHECKS PASSED ====================
  return {
    success: true,
    user,
    data: data as T,
    rawBody,
    request,
  }
}

/**
 * Helper to create a consistent error response from any guard failure.
 * Useful when you want to add additional error context after the guard.
 */
export function guardErrorResponse(
  error: string,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    { success: false, error },
    { status }
  )
}

/**
 * Helper to create a consistent success response.
 * Ensures all API routes return the same `{ success: true, data: ... }` format.
 */
export function guardSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    { success: true, data },
    { status }
  )
}
