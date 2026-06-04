# Task 4-f-a: Convert raw fetch() calls in store slices to apiClient

## Summary
Successfully converted all 25 raw `fetch()` calls across 3 store slice files to use `apiClient` from `@/lib/api-client`.

## Files Modified
1. `src/lib/store/admin.ts` — 10 fetch calls converted
2. `src/lib/store/cart.ts` — 8 fetch calls converted
3. `src/lib/store/order.ts` — 7 fetch calls converted

## Key Decisions
- **admin.ts GET calls**: Used `apiClient.get<T>()` which auto-parses JSON and throws `ApiClientError` on !ok. The `data.success` check is still performed after the call since it's a business logic check, not an HTTP status check.
- **admin.ts PATCH calls**: Used `apiClient.patch()` which throws on !ok. Original code also threw on !ok via `if (!res.ok) throw new Error(...)`. No `data.success` check needed in original, so no raw method needed.
- **cart.ts fire-and-forget calls**: Used `rawPost/rawPut/rawDelete` since the code uses `.then()` chains and checks `data.success` explicitly. Preserved the `.then()` pattern rather than converting to async/await to maintain the fire-and-forget semantics.
- **cart.ts syncFromServer**: Used `apiClient.get<CartSyncResponse>('/api/cart', { userId })` with params object instead of manual URL construction.
- **order.ts status update calls**: Used `rawPut` since code checks `!res.ok || !data.success` explicitly.
- **order.ts wallet deduction**: Used `rawPost` (fire-and-forget in inner try/catch, response not checked).
- **order.ts fetchOrders**: Used `apiClient.get<OrdersResponse>('/api/orders', { userId })` with params object.

## Removed Imports
- `getAuthHeaders` from `'./getAuthHeaders'` in all 3 files

## Added Imports
- `apiClient` from `'@/lib/api-client'` in all 3 files

## Type Aliases Added
- admin.ts: DivisionsResponse, AdminUsersResponse, AdminOrdersResponse, AdminStatsResponse, AdminWithdrawalsResponse, AdminBannersResponse, AdminComplaintsResponse, PlatformSettingsResponse
- cart.ts: CartSyncResponse
- order.ts: OrdersResponse

## Verification
- `bun run lint` passes ✅
- Dev server compiles ✅
