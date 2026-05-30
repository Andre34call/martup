# Task 5 - Security Fixes

## Summary
Fixed 6 security vulnerabilities (SEC-3, SEC-4, SEC-9, SEC-12, SEC-14, SEC-15) across 6 API route files.

## Changes Made

### SEC-9: Lock down login-diagnostic endpoint
- **File**: `src/app/api/auth/login-diagnostic/route.ts`
- Replaced raw `x-admin-secret` header comparison with `verifySuperAdmin` from `@/lib/auth-middleware`
- Removed ALL password hash info from response (hashPrefix, passwordLength, looksLikeBcrypt)
- Removed auto-fix capability (auto-hashing plaintext passwords)
- Kept basic diagnostic info: found, isActive, isVerified, twoFactorEnabled, diagnosis
- Added proper error handling with Indonesian messages
- Removed `bcrypt` import (no longer needed)

### SEC-3: Fix timing-unsafe secret comparisons
Added `import crypto from 'crypto'` and `safeCompare` helper to 3 files, replacing `!==` comparisons:

1. **`src/app/api/admin/init/route.ts`** — Line 44: `secret !== adminSecret` → `!safeCompare(secret, adminSecret)`
2. **`src/app/api/admin/setup/route.ts`** — Line 56: `secret !== adminSecret` → `!safeCompare(secret, adminSecret)`
3. **`src/app/api/auth/sync-user/route.ts`** — Line 47: `internalSecret !== expectedSecret` → `!safeCompare(internalSecret, expectedSecret)`

### SEC-4: Logout should increment tokenVersion
- **File**: `src/app/api/auth/logout/route.ts`
- Added `db` import from `@/lib/db`
- Added `verifyAuth, authErrorResponse` imports from `@/lib/auth-middleware`
- Before clearing cookies, verify auth and get userId
- Increment user's `tokenVersion` in database (`{ increment: 1 }`)
- This invalidates all existing bearer tokens
- Gracefully handles DB errors (still clears cookies even if increment fails)

### SEC-14: Fix Midtrans webhook timing-unsafe signature comparison
- **File**: `src/app/api/payment/notification/route.ts`
- Added `safeCompare` helper function
- Replaced `signature_key !== expectedSignature` with `!safeCompare(signature_key, expectedSignature)`
- Also added null checks for both values

### SEC-15: Midtrans amount validation
- **File**: `src/app/api/payment/notification/route.ts` (same file)
- After finding the order, verify `Number(gross_amount) === Number(order.totalAmount)`
- If mismatch, reject with 400 and log the discrepancy

### SEC-12: Storage setup admin-only
- **File**: `src/app/api/setup/storage/route.ts`
- Removed `verifyAuth` import and fallback
- Only allow `verifyAdmin()` — if admin auth fails, return 403
- Updated JSDoc comment to reflect admin-only security

## Verification
- Lint passes ✅
