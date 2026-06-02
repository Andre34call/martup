Task ID: 5
Agent: code
Task: Split auth-screens.tsx (1,818 lines) into Individual Screen Files

Work Log:
- Read the full 1,818-line auth-screens.tsx file with 8 exported screen components
- Identified all exports: SplashScreen, OnboardingScreen, LoginScreen, RegisterScreen, EmailVerificationScreen, OTPScreen, ForgotPasswordScreen, ResetPasswordScreen
- Checked screen-registry.tsx for import patterns — all 8 screens are lazy-imported from auth-screens
- Created `src/components/ecommerce/auth/` directory with 8 component files + 1 shared file + 1 barrel export
- Split components by domain:
  - `splash-screen.tsx` — SplashScreen (71 lines)
  - `onboarding-screen.tsx` — OnboardingScreen + onboardingSlides constant (122 lines)
  - `login-screen.tsx` — LoginScreen (202 lines; OAuth, Google login, phone→OTP redirect)
  - `register-screen.tsx` — RegisterScreen (185 lines; name/email/phone/password validation)
  - `email-verification.tsx` — EmailVerificationScreen (180 lines; URL param verification, resend)
  - `otp-screen.tsx` — OTPScreen + maskPhone helper (165 lines; phone input → OTP verification)
  - `forgot-password.tsx` — ForgotPasswordScreen (115 lines; email input → success state)
  - `reset-password.tsx` — ResetPasswordScreen (150 lines; token check, password rules, success/error states)
  - `shared.tsx` — Shared types (7 type aliases), validation helpers (7 functions), animation variants (pageVariants, pageTransition), MartUpLogo component
- Created `index.tsx` barrel export that re-exports all 8 screen components
- Replaced original `auth-screens.tsx` with backward-compatible re-export: `export { ... } from './auth'`
- Each file starts with `"use client"` and includes only the imports it needs
- No other files needed updating — screen-registry.tsx imports from `auth-screens` which re-exports from `./auth`
- Lint passes ✅
- Dev server compiles successfully ✅

Stage Summary:
- 1 monolithic 1,818-line file → 8 focused screen modules + 1 shared file + 1 barrel export
- All existing imports in screen-registry.tsx continue to work via backward-compatible re-export in auth-screens.tsx
- Shared code extracted: 7 type aliases, 7 validation helpers, 2 animation variant objects, 1 MartUpLogo component
- Zero breaking changes — lint passes, dev server compiles
