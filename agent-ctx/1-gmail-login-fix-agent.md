# Task 1 — Fix and Harden Gmail Login System

## Summary
Fixed 6 issues in the Gmail/Google OAuth login system that were causing login failures on Vercel serverless deployments.

## Changes Made

### 1. JWT callback error handling (`src/lib/auth.ts`)
- Wrapped both `db.user.findUnique` calls in try/catch blocks
- Sign-in query: If DB fails, sets `token.tokenVersion = 0` instead of crashing
- Refresh query: If DB fails, keeps session alive instead of invalidating it
- Prevents DB cold-start failures from killing the entire auth flow

### 2. signIn callback timeout (`src/lib/auth.ts`)
- Added `signal: AbortSignal.timeout(10000)` to sync-user fetch
- Prevents indefinite hangs when Vercel function is cold-starting
- Outer try/catch handles timeout errors gracefully

### 3. CSRF exemption for signout (`src/proxy.ts`)
- Added `pathname === '/api/auth/signout'` to `isNextAuthRoute`
- Fixes: NextAuth POST to /api/auth/signout was being blocked by CSRF

### 4. Internal secret validation fallback (`src/proxy.ts`)
- Changed from `process.env.INTERNAL_API_SECRET` only to `process.env.INTERNAL_API_SECRET || process.env.NEXTAUTH_SECRET || ''`
- Added `!!expectedSecret` guard to prevent empty-string comparison
- Now matches what `env.INTERNAL_API_SECRET` does in auth.ts

### 5. Improved Google diagnostic endpoint (`src/app/api/auth/google-diagnostic/route.ts`)
- Added DB reachability check with latency measurement
- Added `nextauthUrlEffective` showing computed base URL
- Added detailed `vercelUrl` and `nextauthUrl` values
- Added `internalApiSecret` with 3-state distinction
- Added `database` object with `reachable`, `latencyMs`, `error`
- Added issue detection for localhost NEXTAUTH_URL, missing URLs, DB unreachable, missing secrets

### 6. Fixed misleading log message (`src/lib/auth.ts`)
- Changed 'NEXTAUTH_SECRET not set' to 'INTERNAL_API_SECRET not set'
- The code was checking `env.INTERNAL_API_SECRET`, not `NEXTAUTH_SECRET` directly

## Lint Result
Passed — no errors or warnings.
