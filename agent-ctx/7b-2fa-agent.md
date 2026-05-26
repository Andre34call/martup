# Task 7b — Fix Fake 2FA Toggle in Settings Screen

## Summary
Replaced the cosmetic 2FA toggle with a fully functional Two-Factor Authentication system backed by real OTP verification (enable) and password verification (disable).

## Files Created
- `src/app/api/user/2fa/route.ts` — New API endpoint with GET (check status), POST (send-otp / enable), DELETE (disable with password)

## Files Modified
1. `prisma/schema.prisma` — Added `twoFactorEnabled Boolean @default(false)` to User model
2. `src/lib/types.ts` — Added `twoFactorEnabled?: boolean` to User interface
3. `src/app/api/user-data/route.ts` — Added `twoFactorEnabled: true` to user select query
4. `src/lib/store/data-fetch.ts` — Added `twoFactorEnabled` mapping in fetchUserData
5. `src/components/ecommerce/missing-screens.tsx` — Complete 2FA UX rewrite (loading state, enable/disable dialogs, OTP input)
6. `src/app/api/auth/login/route.ts` — 2FA check after password verification, OTP generation, `requires2FA` flag
7. `src/components/ecommerce/auth-screens.tsx` — 2FA redirect on login, `twoFactorEnabled` in User mapping

## Architecture
- **Enable 2FA**: Toggle ON → Dialog → Send OTP to phone → User enters 6-digit OTP → API verifies → Sets twoFactorEnabled=true
- **Disable 2FA**: Toggle OFF → Dialog → User enters password → API verifies with bcrypt → Sets twoFactorEnabled=false
- **Login with 2FA**: Email+password verified → API checks twoFactorEnabled → Sends OTP → Returns `{requires2FA: true}` → Frontend redirects to OTP screen → Existing OTP verify endpoint completes login

## Security
- All endpoints use verifyAuth from auth-middleware
- Rate limiting on all 2FA operations (5/hr for OTP send, 10/min for verify, 5/min for disable)
- Timing-safe OTP comparison (crypto.timingSafeEqual)
- Password verification with bcrypt for disable
- CSRF tokens via getAuthHeaders(true) on all mutating requests
- Phone numbers masked in API responses
