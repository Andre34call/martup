# Task 2 - Fix API Route Consistency Issues

## Summary
All 8 sub-tasks completed successfully. Lint passes, dev server compiles.

## Changes Made

### 1. Dead Auth Code Deleted
- Deleted `src/lib/auth-helpers.ts` entirely
- Removed `verifyAuthOrSession`, `requireAdminAuth`, `requireStaffAuth`, `requireAuth`, `fromAuthResult`, `authErrorToResponse`, `AuthUserInfo`, `AdminAuthResult` from api-utils.ts
- Removed unused imports from api-utils.ts (`db`, `getServerSession`, `authOptions`, `verifyAuthToken`, `AuthResult`, `AuthError`, `ELEVATED_ROLES`)

### 2. parseJsonField Deduplication
- Removed local parseJsonField from 12 route files, now all import from `@/lib/api-utils`
- Also replaced `safeJsonParse` with `parseJsonField` in products/[id]/route.ts

### 3. Missing `success` Field Fixed
- admin/dashboard: success response now wraps stats in `{ success: true, data: { stats } }`, error has `success: false`
- orders/[id]: All 5 error responses now have `success: false`, GET success has `success: true`
- health: Added admin auth requirement

### 4. Enum Validation Added
- admin/products PUT: status must be one of ['active','draft','blocked','pending','rejected']
- admin/vouchers PUT: type must be 'percentage' or 'fixed'; validFrom/validUntil date validation

### 5. Rate Limiting Migrated to Distributed
- 6 routes migrated from `checkRateLimit` to distributed limiters (authLimiter, sensitiveLimiter, paymentLimiter, apiLimiter)

### 6. Debug Routes Secured
- 4 diagnostic routes now return `{ success: false, error: 'Not found' }` with 404 in production

### 7. N+1 Query Fixed
- admin/users: Uses `_count` for totalOrders, filtered orders for totalSpent

### 8. Root API Route Fixed
- Response changed to `{ success: true, data: { message: "MartUp API v1" } }`
