---
Task ID: 1
Agent: Main Agent
Task: Fix unwanted reset password form after login + App audit for launch-critical issues

Work Log:
- Diagnosed root cause of unwanted reset password: Supabase client auto-detecting sessions in URL
- Fixed Supabase client: set detectSessionInUrl: false, autoRefreshToken: false, persistSession: false
- Fixed login() not clearing resetPasswordToken on login
- Fixed reset-token URL detection in page.tsx to skip if already authenticated
- Conducted comprehensive app audit for launch-critical issues
- Fixed TOKEN_SECRET fallback: use random bytes instead of hardcoded placeholder
- Secured /api/debug/health: require admin auth in production
- Fixed wallet debit race condition: re-check balance inside transaction
- Fixed order stock race condition: re-validate stock inside transaction
- Fixed checkout wallet payment: use per-order amount instead of combined total
- Fixed wallet mutations auth: use verifyAuth instead of requireAuth
- Added unique constraint on VoucherUsage (voucherId, userId, orderId)
- Added Unsplash to CSP img-src
- Enforced password complexity in password change route
- Pushed to Vercel via git push

Stage Summary:
- 12 files modified with critical security and data integrity fixes
- Deployed to Vercel via git push to main branch
- Key fixes: Supabase auth interference, race conditions in wallet/orders, checkout payment bug, debug endpoint security
