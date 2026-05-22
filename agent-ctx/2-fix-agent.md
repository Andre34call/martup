# Task 2 - Fix Agent Work Record

## Summary
Fixed 4 critical data flow issues across the MartUp e-commerce app.

## Changes Made

### 1. profile-screen.tsx - Replace MOCK_USER with store data
- Added `walletBalance`, `walletCoins`, `vouchers` to the useAppStore destructuring
- Stats Row: `MOCK_USER.balance` → `walletBalance`, `MOCK_USER.coins` → `walletCoins.toLocaleString()`, `MOCK_USER.coupons` → `vouchers.filter(v => v.isActive).length`
- Voucher badge: `MOCK_USER.coupons` → `vouchers.filter(v => v.isActive).length`

### 2. profile-screen.tsx - Remove 5MB avatar upload limit
- Removed the `file.size > 5 * 1024 * 1024` check entirely from `handleAvatarUpload`

### 3. seller-screens.tsx - Fix hardcoded 's1' sellerId
- Added `useMemo` to React imports
- `SellerDashboard`: Added `currentUser` from store, derived `sellerId` via sellerMapping, replaced `=== 's1'` filter with `=== sellerId`
- `SellerOrders`: Same pattern - added `currentUser`, derived `sellerId`, replaced filter
- `SellerWallet`: Same pattern - added `currentUser`, derived `sellerId`, replaced filter

### 4. seller-withdraw-screens.tsx - Fix hardcoded 's1' sellerId
- `SellerWithdrawHistoryScreen`: Added `currentUser` from store, derived `sellerId` via sellerMapping, replaced `=== 's1'` filter with `=== sellerId`

### 5. store.ts - Fix requestWithdraw sellerId derivation
- Replaced unreliable chatRooms/orders search with explicit `sellerIdMap`:
  - u2 → s1 (Gadget Pro Store)
  - u3 → s2 (Fashion Hub)
  - u4 → s3 (Beauty Corner)
  - u5 → s4 (Home Living ID)
  - u6 → s5 (Sport Zone)

## Verification
- `bun run lint` passes with no errors
- Dev server compiles successfully
