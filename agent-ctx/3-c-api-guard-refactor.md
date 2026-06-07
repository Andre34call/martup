# Task 3-c: API Guard Refactor Agent

## Summary
Refactored `wishlist/route.ts` and `notifications/route.ts` to use the unified `apiGuard` from `@/lib/api-guard` and Zod schemas from `@/lib/validations`.

## Files Modified
1. `/src/app/api/wishlist/route.ts` — Replaced manual auth/rate-limit/validation with `apiGuard`
2. `/src/app/api/notifications/route.ts` — Replaced manual auth/validation with `apiGuard`

## Key Changes
- Removed direct imports of `verifyAuth`, `authErrorResponse`, `createRateLimiter`
- Added `apiGuard` for auth + rate limit + CSRF + body validation
- Added Zod schema validation via `wishlistAddSchema`, `wishlistDeleteSchema`, `notificationMarkReadSchema`
- Used `successResponse`/`errorResponse` helpers for consistent response shapes
- Used shared `parseProductJsonFields` from `@/lib/json-utils`
- All business logic preserved (ownership checks, product existence, upsert, etc.)
- Lint passes, dev server running
