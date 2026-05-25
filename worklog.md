---
Task ID: 1
Agent: Main Agent
Task: Phase 1 Security Critical Fixes - OTP, Seed Auth, Product Data Leak, Storage Fix

Work Log:
- Reviewed all API routes for auth coverage - confirmed most were already secured
- Created /api/auth/otp/send endpoint with real 6-digit OTP generation, 5-min expiry, rate limiting
- Created /api/auth/otp/verify endpoint with timing-safe comparison, OTP expiry check, user verification
- Updated OTPScreen to use new OTP endpoints instead of insecure sync-user
- Added otpPhoneNumber to NavigationSlice for phone passthrough from login screen
- Locked down sync-user endpoint: removed phone provider, requires x-internal-secret for all
- Fixed seed route: replaced hardcoded secret 'martup-seed-2024' with admin auth
- Fixed product listing: removed sensitive seller bank info (bankAccount, bankName, bankHolder, autoReply)
- Fixed setup/storage: replaced pg dependency with Prisma raw queries (no more module not found error)
- All lint checks pass, dev server running cleanly
- Pushed to GitHub and auto-deploying to Vercel

Stage Summary:
- OTP flow now has real verification (was completely bypassed before - critical security fix)
- Seed endpoint requires admin auth instead of hardcoded secret
- Public product listing no longer exposes seller banking details
- Storage setup no longer requires pg dependency
- Phase 1 Security Critical items are now complete
