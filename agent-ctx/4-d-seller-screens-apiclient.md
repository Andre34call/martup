# Task 4-d: Convert raw fetch() to apiClient in seller-screens.tsx

## Summary
Converted all 7 raw `fetch()` calls in `src/components/ecommerce/seller-screens.tsx` to use `apiClient` from `@/lib/api-client`.

## Changes Made
1. **Import changes**: Removed `getAuthHeaders` from `@/lib/store`, added `import { apiClient, ApiClientError } from '@/lib/api-client'`
2. **Type alias**: Added `type AuthMeResponse = { user?: { id: string } }` at top of file
3. **7 fetch conversions**:
   - DELETE `/api/seller/products` → `apiClient.rawDelete`
   - PUT `/api/orders/{id}/status` (processing) → `apiClient.rawPut`
   - PUT `/api/orders/{id}/status` (shipped) → `apiClient.rawPut`
   - PUT `/api/orders/{id}/status` (cancelled) → `apiClient.rawPut`
   - PUT `/api/seller/profile` → `apiClient.rawPut`
   - GET `/api/auth/me` → `apiClient.get<AuthMeResponse>`
   - DELETE `/api/admin/users` → `apiClient.rawDelete`
4. **Catch blocks**: Improved to check `ApiClientError` first for server error messages

## Verification
- `bun run lint` passes ✅
- Zero remaining `fetch(` or `getAuthHeaders` references
