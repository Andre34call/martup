# Task 7 - full-stack-developer

## Task: Update Wallet & Profile Screens to Use Real APIs

### Status: ✅ COMPLETED

### Summary
Updated all wallet-related screens (Wallet, Deposit, Withdraw) and Profile screen to use real API endpoints instead of mock data. All components now fetch data from the backend APIs, handle loading/error states, and provide proper user feedback.

### Files Modified
1. **`src/lib/store.ts`** — Added `setWalletData` method, reset default wallet values to 0
2. **`src/components/ecommerce/wallet-screen.tsx`** — Real API data, loading skeletons, refresh button
3. **`src/components/ecommerce/missing-screens.tsx`** — Real deposit/withdraw APIs with bank account forms
4. **`src/components/ecommerce/profile-screen.tsx`** — Real user data, role badges, seller store info

### Key Changes
- Wallet screen fetches from `GET /api/wallet` on mount with loading skeleton and pull-to-refresh
- Deposit screen calls `POST /api/wallet/deposit` with success overlay and auto-navigate back
- Withdraw screen calls `POST /api/wallet/withdraw` with bank account form (8 banks), seller-only check
- Profile screen shows real user data, role badge (Buyer/Seller/Admin), seller store name from API
- All amounts formatted in Rupiah (Rp 12.345.678)
- Seller-only restrictions on withdraw (button disabled, warning notice for non-sellers)
- Lint passes with zero errors
