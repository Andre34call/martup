# Auth Medium Fixes — Security Agent

**Task ID**: auth-medium-fixes
**Agent**: security

## Work Log

### Issue 7: Name field sanitization — XSS risk in email templates (MEDIUM)
- Created `/src/lib/security.ts` with `sanitizeHtml(input: string)` function that strips HTML tags via `input.replace(/<[^>]*>/g, '').trim()`
- Added `sanitizeHtml` import to `/src/lib/validations.ts`
- Applied `.transform(sanitizeHtml)` to the `name` field in `registerSchema` — sanitizes at validation time before data reaches the route handler
- Applied `.transform(sanitizeHtml)` to the `name` field in `updateProfileSchema` — covers profile name updates
- Applied `.transform(sanitizeHtml)` to `storeName` in `sellerRegisterSchema` and `sellerProfileUpdateSchema` — covers seller store names which are displayed publicly
- Note: The Zod transform approach sanitizes at the schema level, so the route handlers receive already-sanitized data without needing code changes in those files

### Issue 8: Duplicate phone number check on register (MEDIUM)
- Added phone uniqueness check in `/src/app/api/auth/register/route.ts`
- After Zod validation, if `phone` is provided, queries `db.user.findFirst({ where: { phone, isActive: true } })`
- Returns 400 with "Phone number already registered" if a duplicate is found
- Check is placed BEFORE the email uniqueness check to fail fast on duplicate phones
- Only checks active users to allow re-registration of deactivated accounts

### Issue 9: Register password complexity (MEDIUM)
- Updated `registerSchema` password field in `/src/lib/validations.ts`: added `.regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'Password harus mengandung huruf dan angka')`
- Updated `resetPasswordSchema` password field with same regex — ensures password reset also enforces complexity
- Updated `updatePasswordSchema` `newPassword` field with same regex — ensures password change also enforces complexity
- Note: `registerSchema` and `updatePasswordSchema` already had the regex (added by the HIGH-priority auth agent); I added it to `resetPasswordSchema` which was missing it

### Issue 10: Forgot-password rate limiting improvement (MEDIUM)
- Verified existing IP-based rate limiting via `authLimiter` (10 req/min per IP) ✅
- Added per-email rate limiting: max 3 requests per email per 15 minutes
- Created `forgotPasswordEmailLimiter` using `createRateLimiter` from `@/lib/rate-limit` with `windowMs: 15 * 60 * 1000` and `maxRequests: 3`
- Per-email rate limit checked BEFORE user lookup to prevent timing-based email enumeration
- When rate limited, returns the same success message ("Jika email terdaftar, link reset password telah dikirim.") as normal flow — anti-enumeration preserved
- Updated import to include `createRateLimiter` from `@/lib/rate-limit`

## Files Modified
- `/src/lib/security.ts` — NEW: `sanitizeHtml()` utility function
- `/src/lib/validations.ts` — Added `sanitizeHtml` import + `.transform(sanitizeHtml)` on name/storeName fields; added password regex to `resetPasswordSchema`
- `/src/app/api/auth/register/route.ts` — Added duplicate phone number check
- `/src/app/api/auth/forgot-password/route.ts` — Added per-email rate limiting (3 per email per 15 min)

## Verification
- Lint passes ✅ (`bun run lint` — zero errors)
