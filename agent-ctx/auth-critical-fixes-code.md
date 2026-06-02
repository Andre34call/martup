# Task: auth-critical-fixes — Fix CRITICAL and HIGH auth issues

## Files Modified

### Issue 1: Hash email verification tokens in DB (CRITICAL)
- `src/app/api/auth/register/route.ts` — Hash verification token with SHA-256 before storing; send plain token via email
- `src/app/api/auth/verify-email/route.ts` — Hash received token with SHA-256 before comparing to DB
- `src/app/api/auth/resend-verification/route.ts` — Hash verification token with SHA-256 before storing; send plain token via email

### Issue 2: Session invalidation after password change (HIGH)
- `prisma/schema.prisma` — Added `tokenVersion Int @default(0)` and `failedLoginAttempts Int @default(0)` and `lockedUntil DateTime?` to User model
- `src/lib/auth-middleware.ts` — Updated `generateAuthToken` to include tokenVersion (4-part token format); Updated `verifyAuthToken` to parse and return tokenVersion (backward-compatible with 3-part legacy tokens); Updated `verifyAuth` to check tokenVersion against DB
- `src/app/api/user/password/route.ts` — Increment tokenVersion on password change; generate new session token with updated tokenVersion; set new session cookies
- `src/app/api/auth/login/route.ts` — Pass tokenVersion to generateAuthToken
- `src/app/api/auth/otp/verify/route.ts` — Pass tokenVersion to generateAuthToken

### Issue 3: Password complexity on change (HIGH)
- `src/lib/validations.ts` — Added regex `/^(?=.*[a-zA-Z])(?=.*\d)/` to `registerSchema.password` and `updatePasswordSchema.newPassword`

### Issue 4: Account lockout after failed logins (HIGH)
- `prisma/schema.prisma` — Added `failedLoginAttempts Int @default(0)` and `lockedUntil DateTime?` to User model
- `src/app/api/auth/login/route.ts` — Check if account is locked before processing login; increment failedLoginAttempts on failure; lock for 15 minutes after 5 consecutive failures; reset on success

### Issue 5: OTP codes hashed in DB (MEDIUM)
- `src/app/api/user/2fa/route.ts` — Hash OTP with SHA-256 before storing; hash user-provided OTP before comparing with stored hash
- `src/app/api/auth/login/route.ts` — Hash 2FA OTP with SHA-256 before storing
- `src/app/api/auth/otp/send/route.ts` — Hash OTP with SHA-256 before storing
- `src/app/api/auth/otp/verify/route.ts` — Hash user-provided OTP with SHA-256 before comparing

### Issue 6: Timing-safe plaintext password fallback (MEDIUM)
- `src/app/api/auth/login/route.ts` — Replaced `user.password === password` with `crypto.timingSafeEqual(Buffer.from(user.password), Buffer.from(password))` (with length check to avoid crash)

## Verification
- `npx prisma db push` — Schema synced successfully
- `bun run lint` — All checks pass
