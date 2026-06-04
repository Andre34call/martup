# Task ID: 9+10 — CSP Hardening & Console Statement Cleanup

## Task A: Tighten CSP — Remove unsafe-inline and unsafe-eval

### Changes Made

**`/home/z/my-project/src/middleware.ts`**
- Removed `'unsafe-inline'` and `'unsafe-eval'` from `script-src` CSP directive
- Added per-request nonce generation using `crypto.getRandomValues()` (Edge-compatible) via new `generateNonce()` function
- CSP now uses `script-src 'self' 'nonce-{nonce}' https://vercel.live https://va.vercel-scripts.com`
- Nonce is forwarded to server components via `x-nonce` request header using `NextResponse.next({ request: { headers } })` pattern
- Nonce is also exposed in response header `X-Nonce` for debugging
- Middleware matcher expanded from `/api/:path*` to all routes (excluding static assets) so CSP applies to HTML pages too
- CSRF and rate limiting logic scoped to only `/api/` routes (page requests get security headers + nonce + CSRF cookie but skip validation)
- Kept `'unsafe-inline'` for `style-src` (required by Tailwind CSS — low risk)

**`/home/z/my-project/src/app/layout.tsx`**
- Changed from sync to async function to use `await headers()`
- Reads nonce from `x-nonce` request header set by middleware
- Added `nonce={nonce}` attribute to the JSON-LD `<script type="application/ld+json">` tag
- Next.js automatically applies the nonce to its own injected scripts when CSP nonce header is present

## Task B: Remove Console Statements

### Summary of Changes

| Category | Files | Statements Replaced | Method |
|----------|-------|---------------------|--------|
| API routes (`src/app/api/`) | 66 files | ~137 | `console.error/log/warn` → `logger.error/info/warn` with `import { logger } from '@/lib/logger'` |
| Client components (`src/components/`) | 6 files | ~13 | `console.log` → removed, `console.error/warn` → dev-only guard |
| Store files (`src/lib/store/`) | 11 files | ~51 | `console.log` → removed, `console.error` → dev-only guard |
| Other lib files (`src/lib/`) | 3 files | ~5 | `api-utils.ts` → logger, others → dev-only guard |
| Middleware (`src/middleware.ts`) | 1 file | 0 (kept) | Comment added explaining Edge Runtime limitation |

### Before vs After
- **Before**: ~206 console statements across src/ (all executing in production, leaking sensitive data)
- **After**: 67 remaining console statements
  - 0 in API routes (all replaced with structured Pino logger)
  - 1 in middleware (Edge Runtime — `console.warn` for CSRF failures, with comment explaining why Pino can't be used)
  - 11 in client components (all dev-only guarded with `process.env.NODE_ENV === 'development'`)
  - 50 in store files (all dev-only guarded)
  - 5 in other lib files (3 dev-only guarded, 2 in api-utils.ts replaced with logger)

### Key Technical Details
- All Pino logger calls use structured format: `logger.error({ err: error }, 'message')` instead of `console.error('message:', error)`
- Dev-only guards ensure zero console output in production: `if (process.env.NODE_ENV === 'development') console.error(...)`
- Sensitive data (OTP codes, passwords, tokens) no longer logged in production
- Pino's redaction rules (defined in `src/lib/logger.ts`) provide additional safety layer for any structured data

### Verification
- `bun run lint` — 0 errors, 0 warnings
- TypeScript type check — 0 errors in modified files (1 pre-existing error in missing-screens.tsx unrelated to our changes)
- Dev server running cleanly
