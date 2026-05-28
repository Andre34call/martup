# Task 4-f-c: Convert Store Slice fetch() to apiClient

## Summary
Converted all 16 raw `fetch()` calls across 7 Zustand store slice files to use `apiClient` from `@/lib/api-client`. Removed `getAuthHeaders` imports from all 7 files. Defined type aliases for API response shapes. Lint passes with zero errors.

## Detailed Changes

### auth.ts (3 fetch calls → apiClient)
- POST `/api/seller/register` → `apiClient.rawPost` (preserves `data.success` check and `registerRes.status === 409` check)
- GET `/api/user-data?userId=...` → `apiClient.get<UserDataApiResponse>` (auto-throws on !ok, replaces manual !res.ok check)
- DELETE `/api/user/delete` → `apiClient.del` (fire-and-forget in try/catch)
- Removed `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Added `type UserDataApiResponse = { data?: any; [key: string]: any }`

### seller.ts (3 fetch calls → apiClient)
- POST `/api/seller/withdraw` → `apiClient.rawPost` (preserves `!res.ok` check and custom error extraction)
- GET `/api/seller/stats?sellerId=...` → `apiClient.get<SellerStatsResponse>` (auto-throws on !ok, then checks `data.success`)
- GET `/api/seller/withdraw?sellerId=...` → `apiClient.get<WithdrawHistoryResponse>` (auto-throws on !ok, replaces manual !res.ok + error extraction)
- Removed `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Added type aliases: `SellerStatsResponse`, `WithdrawHistoryResponse`

### profile.ts (2 fetch calls → apiClient)
- POST `/api/user/avatar` (FormData upload) → `apiClient.upload<AvatarUploadResponse>` (handles auth + CSRF + auto Content-Type for FormData)
- DELETE `/api/user/avatar` → `apiClient.del` (auto-throws on !ok)
- Removed `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Added `type AvatarUploadResponse = { data?: any; [key: string]: any }`

### settings.ts (2 fetch calls → apiClient)
- GET `/api/user/settings` → `apiClient.get<UserSettingsResponse>` (auto-throws on !ok)
- PUT `/api/user/settings` → `apiClient.put` (fire-and-forget with `.catch()` for optimistic revert)
- Removed `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Added `type UserSettingsResponse = { data?: any; [key: string]: any }`

### product.ts (2 fetch calls → apiClient)
- GET `/api/products?limit=100` → `apiClient.get<ProductsApiResponse>('/api/products', { limit: '100' })`
- GET `/api/categories` → `apiClient.get<CategoriesApiResponse>('/api/categories')`
- Added `import { apiClient } from '@/lib/api-client'`
- Added type aliases: `ProductsApiResponse`, `CategoriesApiResponse`

### data-fetch.ts (2 fetch calls → apiClient)
- GET `/api/user-data?userId=...` → `apiClient.get<UserDataApiResponse>('/api/user-data', { userId })`
- GET `/api/banners?position=home_top` → `apiClient.get<BannersApiResponse>('/api/banners', { position: 'home_top' })`
- Removed `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Added type aliases: `UserDataApiResponse`, `BannersApiResponse`

### review.ts (2 fetch calls → apiClient)
- POST `/api/reviews` → `apiClient.post` (fire-and-forget with `.catch()`)
- GET `/api/reviews?productId=...` → `apiClient.get<ProductReviewsResponse>('/api/reviews', { productId })`
- Removed `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Added `type ProductReviewsResponse = { success?: boolean; data?: any[]; [key: string]: any }`

## Method Selection Rationale
- **rawPost** used when code explicitly checks `data.success` or `res.status` (auth.ts switchRole)
- **rawPost** used when code explicitly checks `!res.ok` with custom error extraction (seller.ts requestWithdraw)
- **apiClient.get** used for all GET requests (no rawGet available; auto-throws on !ok replaces manual checks)
- **apiClient.post/put/del** used when code just cares about success vs failure
- **apiClient.upload** used for FormData uploads (handles auth + CSRF + Content-Type automatically)

## Verification
- `bun run lint` passes ✅
- Zero `fetch(` calls remaining in all 7 target files
- Zero `getAuthHeaders` references in all 7 target files
- Dev server compiles successfully
