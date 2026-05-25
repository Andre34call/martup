# Security Hardening - Task 6

## Changes Made

### CRITICAL: Authentication Added to Unauthenticated Endpoints

1. **`/api/user-data/route.ts`** — Added `verifyAuth` + user can only fetch own data
   - Previously: Anyone could fetch any user's data by providing userId query param
   - Now: Requires auth + userId must match authenticated user

2. **`/api/wallet/route.ts`** — Added `verifyAuth` + user can only access own wallet + rate limiting
   - Previously: Anyone could read/modify any user's wallet
   - Now: Requires auth + userId must match + rate limiting (10/min) + max top-up cap (Rp 10M)

3. **`/api/seller/register/route.ts`** — Added `verifyAuth` + user can only register themselves + rate limiting
   - Previously: Anyone could register any userId as seller
   - Now: Requires auth + userId must match authenticated user + rate limiting (5/min)

4. **`/api/upload/route.ts`** — Added `verifyAuth` + removed hardcoded Supabase credentials
   - Previously: Anyone could upload files without auth, Supabase keys hardcoded as fallbacks
   - Now: Requires auth + Supabase config must be in env vars + file extension sanitization + folder/bucket sanitization

### Sensitive Data Exposure Fixed

5. **`/api/admin/users/route.ts`** PUT and DELETE — Added `select` to exclude password hash
   - Previously: `db.user.update()` returned ALL fields including password hash
   - Now: Uses explicit `select` to exclude password from response

6. **`/api/auth/sync-user/route.ts`** — Added `select` to exclude password hash
   - Previously: `db.user.findUnique()` with `include` returned all fields including password
   - Now: Uses explicit `select` to exclude password from response

### Input Validation Added

7. **`/api/admin/banners/route.ts`** POST and PUT — Added position enum validation
   - Previously: Any arbitrary position value was accepted
   - Now: Validates position against: home_top, home_mid, home_bottom, category_top, search_top, product_detail, checkout_top, popup

8. **`/api/auth/login/route.ts`** — Added email format validation
   - Previously: Only checked if email was truthy, no format validation
   - Now: Validates email format with regex before querying DB

9. **`/api/upload/route.ts`** — Added file extension sanitization and path traversal prevention
   - Previously: File extension from user input was used directly, folder/bucket names not sanitized
   - Now: Extension validated against allowlist, folder/bucket names stripped of special characters

### Rate Limiting Added

10. **`/api/seller/register/route.ts`** — Added rate limiting (5 requests/min per IP)
11. **`/api/wallet/route.ts`** POST — Added rate limiting (10 requests/min per IP)

### Middleware Security

12. **`/src/middleware.ts`** — Expanded matcher from `/api/admin/:path*` to `/api/:path*`
    - Previously: Security headers (X-Content-Type-Options, X-Frame-Options, etc.) only applied to admin routes
    - Now: Security headers applied to ALL API routes

### Environment Variables

13. **`/src/lib/auth-middleware.ts`** — Added warning when TOKEN_SECRET falls back to default
14. **`/api/upload/route.ts`** — Removed hardcoded Supabase URL/key fallbacks, now requires env vars

### Frontend Auth Headers

15. **`/src/lib/store.ts`** — Updated fetch calls to use `getAuthHeaders()` for:
    - `/api/seller/register`
    - `/api/user-data` (2 calls)

16. **`/src/lib/upload.ts`** — Added auth header to upload function

17. **`/src/components/ecommerce/admin-screens.tsx`** — Added auth header to upload call

18. **`/src/components/ecommerce/checkout-screen.tsx`** — Added auth header to wallet POST

19. **`/src/components/ecommerce/missing-screens.tsx`** — Added auth header to wallet POST

## Verified as Already Secure

- **`/api/auth/register/route.ts`** — Already has email format validation, password length (8+), letter+digit requirement, rate limiting, password excluded from response
- **`/api/auth/login/route.ts`** — Already has rate limiting (5/min), generic error messages (doesn't reveal if email exists), password excluded from response
- **`/api/admin/users/route.ts`** GET — Already manually maps fields excluding password, has role validation with validRoles check, prevents admin from removing own admin role
- **All 13 admin API routes** — All have `verifyAdmin` at the top of each handler function
- **Middleware** — Already has X-Content-Type-Options: nosniff, X-Frame-Options: DENY, no CORS headers allowing all origins
- **.gitignore** — Already excludes .env files
- **Prisma** — Handles SQL injection prevention via parameterized queries
- **`/api/auth/sync-user/route.ts`** — Already has internal secret verification, rate limiting, provider validation
