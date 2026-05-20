# Task 5 - Fix broken functionality in missing-screens.tsx

## Agent: full-stack-developer

## Summary
Fixed all 22 broken functionalities across 9 screen components in `/home/z/my-project/src/components/ecommerce/missing-screens.tsx`.

## Changes Made

### SettingsScreen
- Added `showToast` and `logout` from store
- "Ubah Password" button → info toast
- "Hapus Akun" button → confirm dialog + logout + success toast
- "Bahasa"/"Wilayah" selectors → info toast
- Edit buttons → info toast

### VoucherScreen
- Added `selectVoucher`, `showToast`, `goBack` from store
- "Pakai" button → validates code against store vouchers (case-insensitive), selects voucher + goBack on success, error toast on failure
- "Gunakan" button → selects voucher + success toast + goBack

### AddressScreen
- Added `addAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`, `showToast` from store
- Full form state (7 fields + editingId) with controlled inputs
- Edit button → populates form with address data
- Utamakan button → setDefaultAddress with toast
- Delete button → deleteAddress with toast
- Simpan Alamat → validates, calls addAddress/updateAddress, resets form

### ReviewScreen
- Added `showToast`, `goBack` from store
- Kirim Ulasan → success toast + goBack
- Photo upload → info toast

### RefundScreen
- Added `showToast`, `goBack` from store
- Kirim Pengajuan → success toast + goBack

### HelpScreen
- Added `showToast`, `navigate` from store
- Hubungi CS → toast + navigate to "chat"
- Search filtering on FAQ sections and questions within sections

### FollowedStoresScreen
- Added `setSelectedSeller`, `navigate` from store
- Store card click → setSelectedSeller + navigate to "seller-shop"
- Follow/unfollow button has e.stopPropagation()

### DepositScreen
- Added `topUpWallet`, `showToast`, `goBack`, `walletBalance` from store
- Top Up button → topUpWallet + success toast + goBack
- WalletBalanceCard uses walletBalance from store

### WithdrawScreen
- Added `withdrawWallet`, `showToast`, `goBack`, `walletBalance`, `walletHoldBalance` from store
- Tarik Dana → validates amount vs balance, withdrawWallet + success toast + goBack
- Balance display uses store values

## Verification
- Dev server compiles without errors
- No new lint errors introduced (existing lint error in order-screen.tsx is unrelated)
- TypeScript compilation passes for this file
