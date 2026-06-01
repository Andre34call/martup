import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verifyAuthToken } from '@/lib/auth-middleware'
import type { AuthResult, AuthError } from '@/lib/auth-middleware'
import { ELEVATED_ROLES } from '@/lib/types'
import { logger } from '@/lib/logger'

// ==================== TYPE DEFINITIONS ====================

/** Standard success response shape used across all API routes */
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  message?: string
}

/** Standard error response shape used across all API routes */
export interface ApiErrorResponse {
  success: false
  error: string
  details?: unknown
}

/** Combined API response type */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/** User info extracted from authentication */
export interface AuthUserInfo {
  userId: string
  role: string
  email: string
  name: string
  isVerified: boolean
  isActive: boolean
}

/** Result of admin auth check — either user info or an error response */
export type AdminAuthResult =
  | { userId: string; role: string; email: string; name: string }
  | NextResponse

/** Context parameter for API route handlers (e.g. dynamic route params) */
export interface RouteContext {
  params: Promise<Record<string, string>>
}

// ==================== STANDARDIZED RESPONSE HELPERS ====================

/**
 * Create a standardized success response.
 *
 * All API routes should use this for successful responses to ensure
 * a consistent `{ success: true, data, message? }` shape.
 *
 * @param data    - The response payload
 * @param message - Optional success message
 * @param status  - HTTP status code (default 200)
 */
export function successResponse<T>(data: T, message?: string, status = 200): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = { success: true, data }
  if (message) {
    body.message = message
  }
  return NextResponse.json(body, { status })
}

/**
 * Create a standardized error response.
 *
 * All API routes should use this for error responses to ensure
 * a consistent `{ success: false, error, details? }` shape.
 *
 * @param message  - Human-readable error description
 * @param status   - HTTP status code (default 400)
 * @param details  - Optional extra context (validation errors, etc.)
 */
export function errorResponse(message: string, status = 400, details?: unknown): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { success: false, error: message }
  if (details !== undefined) {
    body.details = details
  }
  return NextResponse.json(body, { status })
}

/**
 * Create a paginated success response.
 *
 * Extends `successResponse` with pagination metadata following the
 * pattern already used in `/api/products` and similar list endpoints.
 *
 * @param data      - The page of items
 * @param total     - Total item count across all pages
 * @param limit     - Items per page
 * @param offset    - Current page offset
 * @param message   - Optional success message
 */
export function paginatedResponse<T>(
  data: T,
  total: number,
  limit: number,
  offset: number,
  message?: string,
): NextResponse<ApiSuccessResponse<T> & { pagination: { total: number; limit: number; offset: number; hasMore: boolean } }> {
  const body = {
    success: true as const,
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    ...(message ? { message } : {}),
  }
  return NextResponse.json(body)
}

/**
 * Create a "not found" error response (status 404).
 * Convenience wrapper around `errorResponse`.
 */
export function notFoundResponse(resource: string): NextResponse<ApiErrorResponse> {
  return errorResponse(`${resource} not found`, 404)
}

/**
 * Create an "unauthorized" error response (status 401).
 * Convenience wrapper around `errorResponse`.
 */
export function unauthorizedResponse(message = 'Unauthorized - Please login first'): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 401)
}

/**
 * Create a "forbidden" error response (status 403).
 * Convenience wrapper around `errorResponse`.
 */
export function forbiddenResponse(message = 'Forbidden - Insufficient permissions'): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 403)
}

/**
 * Create a validation error response (status 422).
 * Includes field-level details for form validation.
 */
export function validationErrorResponse(
  message = 'Validation failed',
  fieldErrors?: Record<string, string[]>,
): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 422, fieldErrors)
}

// ==================== AUTH VERIFICATION HELPERS ====================

/**
 * Verify authentication via Bearer token or NextAuth session.
 *
 * This is the unified entry point that mirrors the logic in
 * `auth-middleware.ts verifyAuth` but returns a simpler
 * `{ userId, role, ... } | null` shape that is easier to
 * consume in route handlers.
 *
 * Verification order:
 *  1. HMAC-signed Bearer token (for email/password users)
 *  2. NextAuth session (for Google OAuth users)
 *
 * Returns `AuthUserInfo` on success, or `null` if unauthenticated.
 */
export async function verifyAuthOrSession(request: NextRequest): Promise<AuthUserInfo | null> {
  // --- Method 1: HMAC-signed Bearer token ---
  const bearerToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (bearerToken) {
    const authResult = verifyAuthToken(bearerToken)
    if (authResult) {
      const dbUser = await db.user.findUnique({
        where: { id: authResult.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          isActive: true,
          tokenVersion: true,
        },
      })
      if (dbUser && dbUser.isActive) {
        // CRITICAL: Validate tokenVersion to reject stale tokens after password change
        if (authResult.tokenVersion !== dbUser.tokenVersion) {
          logger.warn({ userId: dbUser.id, tokenVersion: authResult.tokenVersion, dbVersion: dbUser.tokenVersion }, 'Token rejected — tokenVersion mismatch (password changed)')
          return null
        }
        return {
          userId: dbUser.id,
          role: dbUser.role,
          email: dbUser.email,
          name: dbUser.name,
          isVerified: dbUser.isVerified,
          isActive: dbUser.isActive,
        }
      }
    }
  }

  // --- Method 2: NextAuth session ---
  // SECURITY: NextAuth JWT callback now validates tokenVersion, so if the session
  // is valid here, the tokenVersion check has already been performed in auth.ts.
  try {
    const session = await getServerSession(authOptions)
    if (session?.user) {
      const userEmail = (session.user as Record<string, unknown>).email as string | undefined
      if (userEmail) {
        const dbUser = await db.user.findUnique({
          where: { email: userEmail },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isVerified: true,
            isActive: true,
          },
        })
        if (dbUser && dbUser.isActive) {
          return {
            userId: dbUser.id,
            role: dbUser.role,
            email: dbUser.email,
            name: dbUser.name,
            isVerified: dbUser.isVerified,
            isActive: dbUser.isActive,
          }
        }
      }
    }
  } catch {
    // NextAuth session check failed — treat as unauthenticated
  }

  return null
}

/**
 * Require admin authentication for an API route.
 *
 * Uses `verifyAuthOrSession` internally and returns either the
 * authenticated admin's info, or a ready-to-send 401/403 error response.
 *
 * SECURITY FIX: Now uses ELEVATED_ROLES from the centralized types module
 * instead of only checking `role !== 'admin'`. This allows managers and
 * all division staff (finance, pr, tech, cs, marketing, operations, legal, hr)
 * to access admin routes.
 *
 * Usage:
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAdminAuth(request)
 *   if (auth instanceof NextResponse) return auth
 *
 *   // auth.userId is now guaranteed to be an admin/staff user
 *   ...
 * }
 * ```
 */
export async function requireAdminAuth(request: NextRequest): Promise<AdminAuthResult> {
  const user = await verifyAuthOrSession(request)

  if (!user) {
    return unauthorizedResponse()
  }

  // SECURITY FIX: Use centralized ELEVATED_ROLES instead of hardcoded 'admin' check.
  // This allows all admin, manager, and division staff roles to access admin routes.
  if (!ELEVATED_ROLES.includes(user.role as any)) {
    return forbiddenResponse('Forbidden - Admin access required')
  }

  return {
    userId: user.userId,
    role: user.role,
    email: user.email,
    name: user.name,
  }
}

/**
 * Require staff-level authentication (admin or any staff role).
 *
 * SECURITY FIX: Now uses centralized ELEVATED_ROLES instead of a hardcoded
 * staff roles list, ensuring consistency with the role hierarchy defined
 * in @/lib/types.
 *
 * Usage:
 * ```ts
 * const auth = await requireStaffAuth(request)
 * if (auth instanceof NextResponse) return auth
 * ```
 */
export async function requireStaffAuth(request: NextRequest): Promise<AdminAuthResult> {
  const user = await verifyAuthOrSession(request)

  if (!user) {
    return unauthorizedResponse()
  }

  // SECURITY FIX: Use centralized ELEVATED_ROLES for consistency
  if (!ELEVATED_ROLES.includes(user.role as any)) {
    return forbiddenResponse('Forbidden - Staff access required')
  }

  return {
    userId: user.userId,
    role: user.role,
    email: user.email,
    name: user.name,
  }
}

/**
 * Require any authenticated user (no role restriction).
 *
 * Usage:
 * ```ts
 * const auth = await requireAuth(request)
 * if (auth instanceof NextResponse) return auth
 * ```
 */
export async function requireAuth(request: NextRequest): Promise<AdminAuthResult> {
  const user = await verifyAuthOrSession(request)

  if (!user) {
    return unauthorizedResponse()
  }

  return {
    userId: user.userId,
    role: user.role,
    email: user.email,
    name: user.name,
  }
}

// ==================== REQUEST BODY PARSING ====================

/**
 * Parse a JSON request body with built-in error handling.
 *
 * Returns the parsed body cast to type `T` on success, or a
 * ready-to-send 400 error response if parsing fails.
 *
 * Usage:
 * ```ts
 * const body = await parseRequestBody<{ name: string; email: string }>(request)
 * if (body instanceof NextResponse) return body
 *
 * // body is now typed as { name: string; email: string }
 * ```
 */
export async function parseRequestBody<T>(request: NextRequest): Promise<T | NextResponse<ApiErrorResponse>> {
  try {
    const body = await request.json()
    return body as T
  } catch {
    return errorResponse('Invalid request body', 400)
  }
}

// ==================== QUERY PARAMETER HELPERS ====================

/**
 * Extract and parse search params from a request URL.
 *
 * Returns a `URLSearchParams` object for easy parameter access.
 */
export function getSearchParams(request: NextRequest): URLSearchParams {
  const { searchParams } = new URL(request.url)
  return searchParams
}

/**
 * Get a required string search param, or return an error response if missing.
 *
 * Usage:
 * ```ts
 * const userId = getRequiredParam(request, 'userId')
 * if (userId instanceof NextResponse) return userId
 * ```
 */
export function getRequiredParam(request: NextRequest, name: string): string | NextResponse<ApiErrorResponse> {
  const value = getSearchParams(request).get(name)
  if (!value) {
    return errorResponse(`'${name}' is required`, 400)
  }
  return value
}

/**
 * Get an optional string search param with a default value.
 */
export function getOptionalParam(request: NextRequest, name: string, defaultValue?: string): string | undefined {
  return getSearchParams(request).get(name) ?? defaultValue
}

/**
 * Get a numeric search param, with optional default and bounds checking.
 */
export function getNumericParam(
  request: NextRequest,
  name: string,
  defaultValue: number,
  options?: { min?: number; max?: number },
): number {
  const raw = getSearchParams(request).get(name)
  if (!raw) return defaultValue

  const parsed = parseInt(raw, 10)
  if (isNaN(parsed)) return defaultValue

  if (options?.min !== undefined && parsed < options.min) return options.min
  if (options?.max !== undefined && parsed > options.max) return options.max

  return parsed
}

/**
 * Get pagination parameters (`limit` and `offset`) from query string.
 * Applies sensible defaults and bounds.
 */
export function getPaginationParams(
  request: NextRequest,
  defaults: { limit?: number; offset?: number; maxLimit?: number } = {},
): { limit: number; offset: number } {
  const maxLimit = defaults.maxLimit ?? 100
  const limit = getNumericParam(request, 'limit', defaults.limit ?? 50, { min: 1, max: maxLimit })
  const offset = getNumericParam(request, 'offset', defaults.offset ?? 0, { min: 0 })
  return { limit, offset }
}

// ==================== ERROR HANDLER WRAPPER ====================

/**
 * Wrap an API route handler with standardized error handling.
 *
 * Catches any unhandled errors and returns a 500 response, preventing
 * raw exceptions from leaking to the client. Also logs the error for
 * debugging.
 *
 * Usage:
 * ```ts
 * export const GET = withErrorHandler(async (request) => {
 *   const data = await db.product.findMany()
 *   return successResponse(data)
 * })
 * ```
 *
 * For dynamic routes with context:
 * ```ts
 * export const GET = withErrorHandler(async (request, context) => {
 *   const { id } = await context.params
 *   ...
 * })
 * ```
 */
export function withErrorHandler(
  handler: (request: NextRequest, context?: RouteContext) => Promise<NextResponse>,
): (request: NextRequest, context?: RouteContext) => Promise<NextResponse> {
  return async (request: NextRequest, context?: RouteContext) => {
    try {
      return await handler(request, context)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      logger.error({ err: error, method: request.method, path: new URL(request.url).pathname }, 'API Error')
      return errorResponse(message, 500)
    }
  }
}

// ==================== COMPATIBILITY ADAPTERS ====================

/**
 * Convert an `AuthResult | AuthError` from `auth-middleware.ts` into the
 * new `AuthUserInfo | null` format.
 *
 * This allows routes that still use `verifyAuth` / `verifyAdmin` from
 * `auth-middleware.ts` to bridge into the new utilities without rewriting
 * their auth logic immediately.
 */
export function fromAuthResult(result: AuthResult | AuthError): AuthUserInfo | null {
  if (result.success) {
    return {
      userId: result.user.id,
      role: result.user.role,
      email: result.user.email,
      name: result.user.name,
      isVerified: result.user.isVerified,
      isActive: result.user.isActive,
    }
  }
  return null
}

/**
 * Convert an `AuthError` from `auth-middleware.ts` into a standard
 * `NextResponse` using the new `errorResponse` helper.
 *
 * Drop-in replacement for `authErrorResponse` from auth-middleware.ts
 * that produces the same HTTP response shape via the new utilities.
 */
export function authErrorToResponse(authError: AuthError): NextResponse<ApiErrorResponse> {
  return errorResponse(authError.error, authError.status)
}

// ==================== JSON FIELD HELPERS ====================

/**
 * Safely parse a JSON string field (commonly stored in SQLite TEXT columns).
 *
 * Returns the parsed array, or an empty array if the value is null,
 * undefined, or not valid JSON.  This helper replaces the duplicated
 * `parseJsonField` functions found in `orders/route.ts` and
 * `products/route.ts`.
 */
export function parseJsonField<T = unknown>(value: string | null | undefined): T[] {
  if (!value) return [] as T[]
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : ([] as T[])
  } catch {
    return [] as T[]
  }
}
