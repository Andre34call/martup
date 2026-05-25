# Task 1 - Store Fixer Work Record

## Task: Fix store.ts admin auth headers + cleanup

## Work Done

### Issue 1: Admin API calls missing auth headers
- Added `getAuthHeaders()` helper function that reads `authToken` from `localStorage` and returns headers with `Authorization: Bearer <token>`
- Applied auth headers to all 8 admin API fetch calls:
  - `fetchDivisions` - GET `/api/admin/divisions`
  - `fetchAdminUsers` - GET `/api/admin/users`
  - `assignUserToDivision` - PATCH `/api/admin/users`
  - `updateDivision` - PATCH `/api/admin/divisions`
  - `fetchAdminStats` - GET `/api/admin/stats`
  - `fetchAdminWithdrawals` - GET `/api/admin/withdrawals`
  - `fetchAdminBanners` - GET `/api/admin/banners`
  - `fetchAdminComplaints` - GET `/api/admin/complaints`

### Issue 2: deleteAccount() missing state resets
- Added 16 missing state resets to `deleteAccount()` to match `logout()`:
  - `walletCoins`, `sellerBalance`, `sellerBankAccounts`, `withdrawRequests`
  - `adminUsers`, `adminBanners`, `adminComplaints`, `adminStats`
  - `divisions`, `chatRooms`, `chatMessages`, `totalUnreadChats`
  - `selectedVoucher`, `usedVoucherIds`, `vouchers`, `searchQuery`

### Issue 3: BankAccount type inconsistency
- Changed `holderName` → `accountHolder` in `fetchAdminWithdrawals` mapping to match the `BankAccount` interface in `types.ts`

### Issue 4: Partialize cleanup
- Verified `partialize` config only persists `settings` and `searchHistory`
- `isDataLoaded` is NOT persisted (correct behavior - always starts false)

## Verification
- `bun run lint` passes with no errors
