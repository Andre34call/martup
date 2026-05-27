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
Agent: main
Task: Fix "Gagal menambahkan alamat" (Failed to add address) - CSRF URL-encoding mismatch

Work Log:
- Investigated address-related code: API routes, components, Prisma schema, Zustand store, auth middleware
- Confirmed database-level operations work fine (tested via Prisma directly)
- Discovered server keeps crashing on HTTP requests due to sandbox memory constraints
- Analyzed CSRF flow: proxy sets cookie → client reads from document.cookie → sends as header
- Found ROOT CAUSE: Next.js URL-encodes cookie values (e.g., '=' → '%3D') when setting them
  - Browser stores URL-encoded value in cookie
  - document.cookie returns URL-encoded value
  - Client sends URL-encoded value as x-csrf-token header
  - But proxy's request.cookies.get() URL-decodes the cookie value
  - Result: cookie token ≠ header token → CSRF validation fails
- Verified the fix: decodeURIComponent on client side makes header match server-decoded cookie

Changes Made:
1. src/lib/csrf-client.ts: Added decodeURIComponent() in getCsrfToken() + ensureCsrfToken() and fetchFreshCsrfToken() helpers
2. src/lib/csrf.ts: Added URL-decoding safety net in validateCsrfRequest() + added /api/csrf-token to exempt paths
3. src/proxy.ts: Always refresh CSRF token on GET responses + Indonesian CSRF error message
4. src/lib/store/address.ts: Use ensureCsrfToken() before mutating requests + fetchFreshCsrfToken() for retries
5. src/lib/api-client.ts: Same CSRF improvements as address store
6. src/app/api/csrf-token/route.ts: New endpoint for explicit token refresh
7. src/lib/store/getAuthHeaders.ts: Uses URL-decoded getCsrfToken()

Stage Summary:
- Root cause: CSRF URL-encoding mismatch between cookie (server URL-decoded) and header (client URL-encoded)
- Fix: Double-layered approach - client URL-decodes cookie value + server URL-decodes header as safety net
- All lint checks pass
- Commit pushed to GitHub: 62bdafc
- Will auto-deploy to Vercel
