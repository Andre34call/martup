---
Task ID: 2
Agent: main
Task: Fix database connection + address creation + full app audit

Work Log:
- Diagnosed database connection failure: Supabase changed pooler domain from `.pooler.com` to `.pooler.supabase.com`
- Updated all DB URLs in .env to use new pooler domain
- Updated NEXT_PUBLIC_SUPABASE_ANON_KEY to new valid key (old one was rotated by Supabase)
- Fixed admin password: converted from plain text to bcrypt hash (was causing login to always fail)
- Fixed all test user passwords (buyer, seller, seller2) from plain text to bcrypt
- Fixed address creation: removed unused client-side `id` field, fixed type to `Omit<Address, 'id'|'createdAt'|'updatedAt'>`
- Fixed checkout shipping: added missing CSRF token on POST to `/api/shipping/calculate`
- Fixed phone validation: unified regex between `/api/addresses` and `/api/addresses/[id]` routes
- Fixed auth: case-insensitive Bearer token parsing (RFC 7235 compliance)
- Fixed store types: async address functions now return `Promise<void>` instead of `void`
- Fixed proxy.ts: replaced unreliable `setInterval` with lazy cleanup on each request
- Fixed React Query hooks: response types now match actual API response shape
- Added 'warning' toast type with amber styling and AlertTriangle icon
- Fixed CSRF sameSite comment (Lax, not Strict)
- Improved Prisma connection pool settings (connection_limit=5, pool_timeout=30)
- Verified: login ✅, address creation ✅, address update ✅ on Vercel
- All TypeScript errors resolved (zero `tsc --noEmit` errors)
- All ESLint errors resolved (zero `bun run lint` errors)

Stage Summary:
- Database connection fixed (pooler domain change)
- Address creation fully working on Vercel
- 9 bugs fixed across auth, addresses, checkout, types, and proxy
- Pushed to GitHub (commits 3bc9b0e, 3ce0b87)
- Test account passwords: admin="admin123", buyer/seller="password123"

---
Task ID: 1
Agent: Main Agent
Task: Check Vercel deployment status and fix address add/edit failure

Work Log:
- Checked GitHub deployment history - last successful deployment was commit 2cde622c on May 26, 2026 at 06:56 UTC
- Found that all deployments after 2cde622c have FAILED
- Discovered the ROOT CAUSE of address add/edit failure: The deployed Vercel code uses `__Host-csrf-token` cookie with httpOnly=true, preventing JavaScript from reading the CSRF token for the double-submit pattern
- Verified the fix already exists in the current codebase (commit 62bdafc): cookie name is `csrf-token`, httpOnly=false
- The fix was never deployed because Vercel builds kept failing
- Local build succeeds cleanly with the current code
- Pushed 2 commits (cfa7862 and f31da07) to GitHub but Vercel auto-deploy is not configured
- Created GitHub release v1.1.0-csrf-fix but it didn't trigger Vercel deployment
- No Vercel authentication credentials available on this machine to deploy directly

Stage Summary:
- Address add/edit failure root cause: CSRF cookie is httpOnly on deployed Vercel code, JavaScript can't read it
- Fix is already in the codebase but NOT deployed to Vercel
- User needs to deploy manually via Vercel dashboard or CLI
- Last successful Vercel deployment: commit 2cde622c, May 26 2026 06:56 UTC
- Current deployed version: 1.0.0 (old, broken CSRF)
- Latest code version: 1.1.0-csrf-fix (fixed CSRF)
