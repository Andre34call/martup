# Task 3-4: Fix Login Flow and OTP Screen Security Vulnerabilities

## Agent: Security Fix Agent

## Summary
Fixed 2 critical security vulnerabilities in auth-screens.tsx and extended sync-user API to support phone-based OTP authentication.

## Changes Made

### 1. LoginScreen handleLogin (`src/components/ecommerce/auth-screens.tsx`)
- **Before**: Called `/api/auth/sync-user` (Google OAuth only) — password was never sent, no real authentication
- **After**: Proper login flow:
  - Detects phone numbers → redirects to OTP screen
  - Emails → calls `/api/auth/login` with `{ email, password }`
  - Stores `authToken` in localStorage
  - Error toast feedback on failure
  - Removed fake `setTimeout` delay
- **Password validation**: Changed minimum from 6 → 8 characters (matching registration)

### 2. OTPScreen (`src/components/ecommerce/auth-screens.tsx`)
- **Before**: Hardcoded phone `'+628120000789'` — every OTP user was the same person
- **After**: Two-step flow:
  - Step 1: Phone input with validation
  - Step 2: OTP entry with masked phone display
  - `maskPhone()` helper for privacy
  - Uses actual phone number in API call
  - Error toast feedback

### 3. sync-user API (`src/app/api/auth/sync-user/route.ts`)
- Added `'phone'` to allowed providers
- Phone provider: no `x-internal-secret` required, lookup by phone, generates auth token
- Google provider: unchanged (still requires internal secret)

## Verification
- ESLint: zero errors
- Dev server: no new compilation errors
