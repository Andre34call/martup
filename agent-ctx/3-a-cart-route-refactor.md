# Task 3-a: Cart Route Refactor

## Summary
Refactored `src/app/api/cart/route.ts` to use the new `apiGuard` from `src/lib/api-guard.ts` and Zod schemas from `src/lib/validations.ts`.

## Changes Made

### File Modified: `src/app/api/cart/route.ts`

**Imports replaced:**
- Removed: `verifyAuth, authErrorResponse` from `@/lib/auth-middleware`
- Removed: `createRateLimiter` from `@/lib/rate-limit` and `cartLimiter` constant
- Added: `apiGuard` from `@/lib/api-guard`
- Added: `cartAddSchema, cartMergeSchema, cartUpdateSchema, cartDeleteSchema, validateBody` from `@/lib/validations`
- Added: `successResponse, errorResponse, parseRequestBody` from `@/lib/api-utils`

**Per-handler changes:**
- **GET**: `apiGuard(request, { auth: 'user', csrf: false })` — no CSRF for reads
- **POST**: `apiGuard(request, { auth: 'user', rateLimit: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:cart:' } })` — no schema at guard level (mode-dependent), manual `validateBody` for add/merge modes
- **PUT**: `apiGuard(request, { auth: 'user', schema: cartUpdateSchema })` — guard validates body
- **DELETE**: `apiGuard(request, { auth: 'user', schema: cartDeleteSchema })` — guard validates body

**Security improvements:**
- CSRF now automatically enforced for POST/PUT/DELETE (was missing before)
- Zod validation catches malformed input before business logic

**Business logic preserved:**
- All product existence checks, stock validations, ownership checks, upsert logic unchanged
- `serializeDecimal`, `parseCartItemFields` calls preserved
- Indonesian error messages preserved

## Verification
- `bun run lint` passes with no errors
- Dev server running correctly on port 3000
