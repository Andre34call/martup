# Task 2g-addr-seller: Address & Seller Store API Sync

## Summary
Synced Zustand store slices (address, seller, profile) with server-side APIs so that server is the source of truth.

## Changes Made

### `/home/z/my-project/src/lib/store/types.ts`
- Added `fetchAddresses(userId: string) => Promise<void>` to `AddressSlice`
- Added `fetchWithdrawHistory(sellerId: string) => Promise<void>` to `SellerSlice`
- Added `uploadAvatar(file: File) => Promise<void>` to `ProfileSlice`
- Added `removeAvatar() => Promise<void>` to `ProfileSlice`

### `/home/z/my-project/src/lib/store/address.ts`
- `addAddress` → Now calls `POST /api/addresses`, updates local state with server response only on success
- `updateAddress` → Now calls `PUT /api/addresses`, updates local state with server response only on success
- `deleteAddress` → Now calls `DELETE /api/addresses`, updates local state only on success
- `setDefaultAddress` → Now calls `PUT /api/addresses` with `{ addressId, isDefault: true }`, updates local state only on success
- Added `fetchAddresses(userId)` → Calls `GET /api/addresses?userId=xxx`, replaces local state with server data
- All methods now async, throw errors on API failure (no local state update on failure)
- Uses `getAuthHeaders()` for auth

### `/home/z/my-project/src/lib/store/seller.ts`
- `requestWithdraw` → Now calls `POST /api/seller/withdraw`, updates local state with server response on success
- Added `fetchWithdrawHistory(sellerId)` → Calls `GET /api/seller/withdraw?sellerId=xxx`, replaces local withdrawRequests with server data
- If API fails, local balance is NOT updated (server is source of truth)
- Uses `getAuthHeaders()` for auth

### `/home/z/my-project/src/lib/store/profile.ts`
- Added `uploadAvatar(file: File)` → Uploads via `POST /api/user/avatar` using FormData (no Content-Type header set), updates `avatarUrl` and `currentUser.avatar` on success
- Added `removeAvatar()` → Calls `DELETE /api/user/avatar`, clears `avatarUrl` and `currentUser.avatar` on success
- `updateAvatar(url)` kept as-is for external URL setting
- Uses `getAuthHeaders()` for DELETE (FormData upload does NOT set Content-Type manually)

### `/home/z/my-project/src/components/ecommerce/missing-screens.tsx`
- Updated `handleSaveAddress` to async/await with error handling and `isSaving` state
- Updated `handleSetDefault` to async/await with error handling
- Updated `handleDelete` to async/await with error handling

### `/home/z/my-project/src/components/ecommerce/seller-withdraw-screens.tsx`
- Updated `handleSubmit` to async/await with proper error handling (removed fake setTimeout delay)

## Lint
- `bun run lint` passes with zero errors
