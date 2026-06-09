# API Guard Agent — Task 1

## Task
Create unified API guard module at `src/lib/api-guard.ts`

## What Was Done
Created `/src/lib/api-guard.ts` — a single module that eliminates the repetitive auth/rate-limit/validation/CSRF boilerplate found in every API route.

## File
- `/src/lib/api-guard.ts` (304 lines)

## Exports
- **Types**: `AuthLevel`, `RateLimiterInstance`, `GuardConfig`, `GuardResult<T>`
- **Functions**: `apiGuard<T>(request, config?)`, `createHandler<T>(config, handler)`

## Dependencies Verified
- `auth-middleware.ts`: verifyAuth/verifyAdmin/verifyManager/verifySuperAdmin/verifyStaff + authErrorResponse + AuthResult/AuthError types
- `rate-limit.ts`: createRateLimiter + RateLimiterConfig + RateLimitResult types
- `validations.ts`: validateBody
- `csrf.ts`: validateCsrfRequest
- `api-utils.ts`: successResponse, errorResponse, parseRequestBody
- `logger.ts`: logger (Pino)

## Verification
- ESLint: passes
- Dev server: running on port 3000
