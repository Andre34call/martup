# Task 4-e: Convert raw fetch() calls in providers.tsx to apiClient

## Summary
Converted 2 raw `fetch()` calls in `src/components/ecommerce/providers.tsx` to use `apiClient` from `@/lib/api-client`.

## Changes Made

### File: `src/components/ecommerce/providers.tsx`

1. **Import changes:**
   - Added `import { apiClient } from '@/lib/api-client'`
   - Removed `getAuthHeaders` from `import { useAppStore, getAuthHeaders } from "@/lib/store"` → `import { useAppStore } from "@/lib/store"`

2. **Added `AuthMeResponse` interface** — typed response shape for `/api/auth/me` to avoid TSX generic parsing ambiguity with `apiClient.get<AuthMeResponse>`

3. **Storage setup** (POST `/api/setup/storage`):
   - Before: `fetch('/api/setup/storage', { method: 'POST', headers: getAuthHeaders(true) })`
   - After: `apiClient.rawPost('/api/setup/storage', undefined)`
   - `rawPost` auto-adds auth headers + CSRF with retry (superset of `getAuthHeaders(true)`)
   - Preserved `.then(res => res.json()).then(data => { if (data.success)... }).catch(...)` chain

4. **Auth/me GET** (Google OAuth bridge):
   - Before: `fetch('/api/auth/me').then(res => res.json()).then(data => { ... }).catch(...)`
   - After: `apiClient.get<AuthMeResponse>('/api/auth/me')` with async IIFE + try/catch
   - `apiClient.get` auto-parses JSON, throws `ApiClientError` on non-OK (defensive, caught by try/catch)
   - All business logic preserved: login(), setSentryUser(), connectSocket()

## Verification
- `bun run lint` passes ✅
- Zero raw `fetch()` calls remain in providers.tsx
- Zero references to `getAuthHeaders` remain in providers.tsx
