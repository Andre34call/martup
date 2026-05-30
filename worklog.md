---
Task ID: 1
Agent: Main Agent
Task: Fix all LOW priority auth issues #17-25

Work Log:
- Fixed LOW #17: Added "Remember Me" checkbox to login screen
  - Updated session-cookie.ts to accept `rememberMe` parameter — sets maxAge=30 days when true, session cookie when false
  - Updated login route to extract `rememberMe` from request body and pass to setSessionCookies
  - Added Checkbox UI component to LoginScreen with "Ingat saya" label
  - Login API call now includes `rememberMe` in request body
- Fixed LOW #18: Added email notification when account gets locked
  - Added `accountLockedTemplate()` to email.ts with security warning email template
  - Login route now sends lockout notification email when account is locked after 10 failed attempts
  - Email includes lockout duration, security recommendations, and reset password link
- Fixed LOW #19: Marked Apple Sign-In button as "Coming Soon"
  - Changed button to always disabled (disabled={true})
  - Added opacity-70 for visual dimming
  - Added "Segera Hadir" badge (amber badge) on top-right of button
  - Still shows toast on click for accessibility
- Fixed LOW #20: Added "Logout All Devices" endpoint
  - Created POST /api/auth/logout-all route
  - Increments tokenVersion to invalidate all existing sessions
  - Also clears current session cookies
  - Returns Indonesian message about all devices being logged out
- Fixed LOW #21: Standardized error messages to Indonesian
  - Changed auth-middleware.ts: "Session expired - Please login again" → "Sesi telah berakhir. Silakan login kembali."
  - Changed auth-middleware.ts: "Unauthorized - Please login first" → "Belum terautentikasi. Silakan login terlebih dahulu."
  - Changed auth-middleware.ts: "Forbidden - Admin access required" → "Akses ditolak. Diperlukan akses admin."
  - Changed auth-middleware.ts: "Forbidden - Manager or Super Admin access required" → "Akses ditolak. Diperlukan akses Manager atau Super Admin."
  - Changed auth-middleware.ts: "Forbidden - Super Admin access required" → "Akses ditolak. Diperlukan akses Super Admin."
  - Changed auth-middleware.ts: "Forbidden - Staff access required" → "Akses ditolak. Diperlukan akses staf."
  - Changed me/route.ts: "User not found" → "Pengguna tidak ditemukan"
  - Changed me/route.ts: "Account is blocked" → "Akun telah diblokir"
  - Changed me/route.ts: "Internal server error" → "Terjadi kesalahan server"
- Fixed LOW #22: Verified name validation already aligned (min 2 on both frontend and backend)
  - Frontend: name.length < 2 → "Nama minimal 2 karakter"
  - Backend: .min(2, 'Nama minimal 2 karakter')
  - No changes needed — already consistent
- Fixed LOW #23: Documented isSuperAdmin flag exposure
  - Added security comments to /api/auth/me and /api/auth/login explaining that isSuperAdmin is only in own-user responses
  - Not exposed in any user-listing API (admin user management)
  - No additional risk beyond what role already reveals
- Fixed LOW #24: Added change-password endpoint
  - Created POST /api/auth/change-password route
  - Requires: currentPassword, newPassword, confirmPassword
  - Validates with updatePasswordSchema (Zod)
  - Verifies current password with bcrypt
  - Ensures new password differs from current
  - Rejects OAuth-only users (no password set)
  - Increments tokenVersion to invalidate all sessions
  - Clears any pending reset tokens
  - All error messages in Indonesian
- Fixed LOW #25: Improved OTP fake email pattern
  - Changed from `phone_XXXX@martup.internal` to `otp_{digits}_{randomHex}@martup.internal`
  - Uses crypto.randomBytes(6).toString('hex') for 12-char random ID
  - Prevents collision when same phone number re-registers
  - More clearly identifies these as OTP-generated accounts

Stage Summary:
- All 9 LOW priority issues (#17-25) fixed
- 2 new API endpoints: /api/auth/change-password, /api/auth/logout-all
- 1 new email template: accountLockedTemplate
- 1 new UI element: "Remember Me" checkbox on login screen
- Error messages now fully Indonesian across auth middleware
- Apple Sign-In button clearly marked as coming soon
- ESLint passes clean
- Dev server compiles successfully
