# Task 7 — Password Change API Agent

## Task Summary
Create a real POST /api/user/password endpoint and update the Settings screen to use it instead of the fake toast-only implementation.

## Work Completed

### 1. Created `/src/app/api/user/password/route.ts`
- POST handler with full authentication (verifyAuth)
- Rate limit: 3 attempts/min per user
- Validations: all fields present, newPassword >= 8 chars, newPassword === confirmPassword, newPassword !== currentPassword
- Fetches user's password hash from DB
- Handles OAuth-only users (no password set) with clear error
- Verifies current password with bcrypt.compare()
- Hashes new password with bcrypt.hash(newPassword, 12) — matches register pattern
- Updates DB with new password
- Security logging for failed attempts and successful changes

### 2. Updated `/src/components/ecommerce/missing-screens.tsx`
- Added `isChangingPassword` loading state
- Replaced fake `handleChangePassword` with real async API call
- Added client-side validation: newPassword !== currentPassword
- Uses `getAuthHeaders(true)` for auth + CSRF token
- Shows loading text "Menyimpan..." on button during API call
- Button disabled while loading
- Shows API error messages on failure
- Shows network error on fetch failure
- Clears form and closes dialog on success

## Files Modified
- `src/app/api/user/password/route.ts` (NEW)
- `src/components/ecommerce/missing-screens.tsx` (MODIFIED)

## Lint Status
0 errors, 0 warnings

## Dev Server
Running cleanly on port 3000
