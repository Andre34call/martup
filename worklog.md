---
Task ID: 1
Agent: main
Task: Fix login issues - user cannot login via email/password or Google OAuth, even as admin

Work Log:
- Analyzed entire auth system: login route, register route, NextAuth config, sync-user, auth/me, auth-middleware, CSRF, middleware
- Identified 4 critical root causes for login failure:
  1. Register creates unverified users but email provider is mock (doesn't send real emails) → users stuck in unverified state
  2. No admin user exists → chicken-and-egg problem (seed requires admin auth but no admin exists)
  3. NEXTAUTH_URL fallback to localhost on Vercel breaks Google OAuth sync-user flow
  4. Poor error messages for database connectivity issues
- Created /api/ping - zero-dependency health check endpoint
- Fixed register route: auto-verify users when email provider is mock (no RESEND_API_KEY)
- Created /api/admin/init endpoint: creates first admin user when no admin exists (fixes chicken-and-egg)
- Fixed NEXTAUTH_URL fallback in auth.ts: VERCEL_URL > NEXTAUTH_URL > localhost
- Improved login error messages for P1001/P1002/ENOTFOUND database errors
- Added ADMIN_SETUP_SECRET to .env and env.ts
- Added CSRF and middleware exemptions for new endpoints
- Pushed all fixes to GitHub (commit 25b660e)

Stage Summary:
- All auth fixes pushed to GitHub and auto-deploying to Vercel
- User needs to set env vars in Vercel Dashboard and create admin via /api/admin/init
- Key instruction for user: test /api/ping first, then /api/debug/health, then create admin
