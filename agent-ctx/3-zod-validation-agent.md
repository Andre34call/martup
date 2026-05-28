# Task 3: Add Zod validation schemas to critical API routes

## Summary
Created centralized Zod validation schemas and applied them to 7 critical API routes, replacing inline manual validation with type-safe schemas.

## Changes Made

### New File
- `/src/lib/validations.ts` — 13 Zod schemas + `validateBody` helper (adapted for Zod v4 API)

### Modified API Routes
1. **auth/login** — `loginSchema` replaces manual email/password + regex checks
2. **auth/register** — `registerSchema` replaces name/email/password inline validation
3. **user/password** — `updatePasswordSchema` replaces field presence + length/complexity checks
4. **user/2fa** — `twoFactorActionSchema` (POST) + `twoFactorDisableSchema` (DELETE)
5. **admin/categories** — `adminCategoryCreateSchema` (POST), `adminCategoryUpdateSchema` (PUT), `adminCategoryDeleteSchema` (DELETE)
6. **admin/vouchers** — `adminVoucherCreateSchema` (POST); PUT/DELETE kept inline checks
7. **admin/deposits** — `adminDepositActionSchema` (PUT) replaces depositId/status + enum checks

## Key Decisions
- Used `error.issues[0]` instead of `error.errors[0]` in validateBody (Zod v4 API difference)
- Kept business-logic checks (password match, password diff) outside Zod schemas
- Extra fields not in schemas (slug, image, description) extracted from raw body
- Admin permission checks kept BEFORE validation as required
- GET routes NOT validated (query params, not body)

## Verification
- `bun run lint` passes ✅
- Dev server compiles ✅
