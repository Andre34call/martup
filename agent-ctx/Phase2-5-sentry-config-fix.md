# Task: Phase2-5 - Fix TypeScript errors in Sentry configuration files

## Summary
Fixed TypeScript errors in Sentry configuration files for @sentry/nextjs v10.53.1 compatibility.

## Changes Made

### 1. sentry.client.config.ts
- **Bug**: `replaysIntegration` was used as a top-level property in `Sentry.init()` — this is not a valid option in v10.x
- **Fix**: Moved `Sentry.replayIntegration({...})` into the `integrations` array where it belongs
- `replaysSessionSampleRate` and `replaysOnErrorSampleRate` remain as valid top-level options

### 2. next.config.ts
- **Bug**: `hideSourceMaps: true` was passed to `withSentryConfig` — this option does not exist in v10.x
- **Fix**: Removed `hideSourceMaps: true` from the second argument; source map hiding is handled automatically by the SDK in v10.x
- Kept `silent: true` which is still a valid option

### 3. sentry.server.config.ts & sentry.edge.config.ts
- No issues found — simple configs with dsn, debug, tracesSampleRate only

### 4. Bonus: /api/orders/[id]/status/route.ts
- Fixed pre-existing TS error: `trackingNumber` possibly undefined at line 284
- Added non-null assertion (`trackingNumber!.trim()`) since validation at line 110 guarantees it's defined when status is 'shipped'

## Verification
- `npx tsc --noEmit`: 0 errors in src/ directory
- `bun run lint`: 0 errors, 0 warnings
- Dev server running cleanly
