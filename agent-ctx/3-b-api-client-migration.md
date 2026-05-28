# Task 3-b: Replace raw fetch() with apiClient in settings and misc screens

## Summary
Replaced all raw `fetch()` calls with `apiClient` from `@/lib/api-client` across 4 screen files (11 total conversions).

## Files Modified

### 1. `src/lib/api-client.ts`
- Added `patch` method (typed, returns parsed JSON, auto auth + CSRF + retry)
- Added `rawPatch` method (returns raw Response, auto auth + CSRF + retry)
- Needed because admin-workflow-screen.tsx uses PATCH HTTP method

### 2. `src/components/ecommerce/screens/settings-screen.tsx`
- 5 raw fetch calls converted:
  - GET `/api/user/2fa` → `apiClient.get`
  - POST `/api/user/2fa` (send-otp) → `apiClient.post`
  - POST `/api/user/2fa` (enable) → `apiClient.post`
  - DELETE `/api/user/2fa` (disable) → `apiClient.del`
  - POST `/api/user/password` → `apiClient.rawPost` (needs `res.ok` status check)
- Removed `getAuthHeaders` from `@/lib/store` import
- Added `import { apiClient, ApiClientError } from '@/lib/api-client'`
- Catch blocks now show server error messages via `ApiClientError` instead of generic fallback

### 3. `src/components/ecommerce/screens/voucher-screen.tsx`
- 1 raw fetch call converted:
  - GET `/api/vouchers` → `apiClient.get`
- Added `import { apiClient } from '@/lib/api-client'`

### 4. `src/components/ecommerce/admin-workflow-screen.tsx`
- 4 raw fetch calls converted:
  - GET `/api/admin/work-items?...` → `apiClient.get` with params object
  - PATCH `/api/admin/work-items` (status change) → `apiClient.patch`
  - PATCH `/api/admin/work-items` (assign to me) → `apiClient.patch`
  - POST `/api/admin/work-items` (create) → `apiClient.post`
- Removed `import { getAuthHeaders } from '@/lib/store/getAuthHeaders'`
- Added `import { apiClient, ApiClientError } from '@/lib/api-client'`
- Defined 3 interface types (WorkItemsResponse, WorkItemMutationResponse, WorkItemCreateResponse) to avoid TSX generic parsing ambiguity with `Record<string, number>` inside generic parameters

### 5. `src/components/ecommerce/admin-orders-screen.tsx`
- 1 raw fetch call converted:
  - PUT `/api/admin/orders` → `apiClient.put`
- Added `import { apiClient, ApiClientError } from '@/lib/api-client'`
- Original code was missing auth headers — `apiClient.put` adds them automatically

## Key Decisions
- Used `apiClient.rawPost` for password change (per task instructions) since the code checks both `res.ok` and `data.success`
- Used typed methods (`apiClient.post`, `apiClient.del`, `apiClient.patch`, `apiClient.put`) for all other calls
- All catch blocks use `ApiClientError` to extract server error messages for better UX
- Added `patch`/`rawPatch` to apiClient to support PATCH HTTP method used by workflow screen

## Verification
- `bun run lint` passes ✅
- Dev server compiles successfully ✅
