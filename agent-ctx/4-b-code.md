# Task 4-b: Convert auth-screens.tsx fetch calls to apiClient

## Summary
Converted all 7 raw `fetch()` calls in `src/components/ecommerce/auth-screens.tsx` to use `apiClient` from `@/lib/api-client`.

## Key Decisions
1. **Login uses `apiClient.rawPost`** — The login API returns 403 with `requiresVerification: true` and `email` fields in the response body. Using `apiClient.post` would throw `ApiClientError` and lose these fields. `rawPost` preserves the raw Response for manual JSON parsing.

2. **All other calls use `apiClient.post<T>`** — Register, resend-verification, OTP send/verify, forgot-password, and reset-password all return 200 for success cases, so `apiClient.post` works well with `ApiClientError` catch for error messages.

3. **`isValidEmail` replaced with Zod** — Uses `loginSchema.shape.email.safeParse(email).success` for consistency with server-side validation.

4. **`isValidPhone` and `isValidPassword` kept as-is** — No Zod schema equivalents exist for phone regex or password complexity.

## Files Modified
- `src/components/ecommerce/auth-screens.tsx` — Only file modified per task requirements
  - Added imports: `apiClient`, `ApiClientError`, `loginSchema`
  - Added 7 type aliases at top of file
  - Replaced `isValidEmail` regex with Zod-based validation
  - Converted 7 fetch calls to apiClient methods
  - Improved catch blocks with `ApiClientError` awareness

## Lint Status
- ✅ `bun run lint` passes with zero errors
