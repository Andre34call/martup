# Task 4-f-b: Convert store slice fetch calls to apiClient

## Work Log

Converted ALL raw `fetch()` calls in 5 store slice files to use `apiClient` from `@/lib/api-client`.

### chat.ts — 5 fetch calls converted
- Removed `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Defined type aliases: `ChatRoomsResponse`, `ChatMessagesResponse`
- Conversions:
  1. `markChatRead` PUT → `apiClient.rawPut` (fire-and-forget with `.catch(() => {})`)
  2. `fetchChatRooms` GET → `apiClient.get<ChatRoomsResponse>` (auto-parses JSON, throws on !ok)
  3. `fetchChatMessages` GET → `apiClient.get<ChatMessagesResponse>` (with `roomId` query param)
  4. `sendChatMessage` POST → `apiClient.rawPost` (preserves `!res.ok` check + `data.success` check)
  5. `createChatRoom` POST → `apiClient.rawPost` (preserves `!res.ok` check + `data.success` check)

### wallet.ts — 4 fetch calls converted
- Removed `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Defined type aliases: `WalletBalanceResponse`, `WalletMutationsResponse`
- Conversions:
  1. `topUpWallet` POST → `apiClient.rawPost` (preserves `!res.ok || !data.success` check with custom error messages)
  2. `withdrawWallet` POST → `apiClient.rawPost` (preserves `!res.ok || !data.success` check with custom error messages)
  3. `fetchWalletBalance` GET → `apiClient.get<WalletBalanceResponse>` (auto-throws on !ok; checks `!result.success` for soft failure)
  4. `fetchWalletMutations` GET → `apiClient.get<WalletMutationsResponse>` (auto-throws on !ok; preserves `items || mutations || result` fallback)

### address.ts — 5 fetch calls converted + local fetchWithCsrfRetry removed
- **Deleted** local `fetchWithCsrfRetry` function (lines 8-52 of original)
- **Removed** `import { ensureCsrfToken, fetchFreshCsrfToken } from '@/lib/csrf-client'`
- **Removed** `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Defined type aliases: `AddressMutationResponse`, `AddressesResponse`
- Conversions:
  1. `addAddress` POST → `apiClient.rawPost` (preserves `!res.ok` check with custom error messages incl. HTTP status)
  2. `updateAddress` PUT → `apiClient.rawPut` (preserves `!res.ok` check)
  3. `deleteAddress` DELETE → `apiClient.rawDelete` (preserves `!res.ok` check)
  4. `setDefaultAddress` PUT → `apiClient.rawPut` (preserves `!res.ok` check)
  5. `fetchAddresses` GET → `apiClient.get<AddressesResponse>` (auto-throws on !ok; processes `data.data`)

### wishlist.ts — 3 fetch calls converted
- Removed `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Defined type alias: `WishlistSyncResponse`
- Conversions:
  1. DELETE `/api/wishlist` → `apiClient.rawDelete` (preserves `.then().then().catch()` pattern with `data.success` check + revert logic)
  2. POST `/api/wishlist` → `apiClient.rawPost` (preserves `.then().then().catch()` pattern with `data.success` check + revert logic)
  3. `syncWishlistFromServer` GET → `apiClient.get<WishlistSyncResponse>` (auto-parses JSON, checks `data.success && data.data`)

### notification.ts — 3 fetch calls converted
- Removed `import { getAuthHeaders } from './getAuthHeaders'`
- Added `import { apiClient } from '@/lib/api-client'`
- Defined type alias: `NotificationsResponse`
- Conversions:
  1. `markNotificationRead` PUT → `apiClient.rawPut` (fire-and-forget with `.catch(() => {})`)
  2. `markAllNotificationsRead` PUT → `apiClient.rawPut` (fire-and-forget with `.catch(() => {})`)
  3. `fetchNotifications` GET → `apiClient.get<NotificationsResponse>` (auto-parses JSON, checks `data.success && data.data`)

## Summary
- 20 raw fetch calls replaced with apiClient methods across 5 store slice files
- 1 local `fetchWithCsrfRetry` function deleted (address.ts)
- `getAuthHeaders` import removed from all 5 files
- `ensureCsrfToken`/`fetchFreshCsrfToken` imports removed from address.ts
- All calls now benefit from automatic auth headers, CSRF protection with retry
- All business logic preserved exactly (error messages, state updates, control flow)
- Zero breaking changes — lint passes ✅
