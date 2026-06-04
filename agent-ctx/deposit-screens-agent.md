# Task: Create Deposit History & Deposit Detail Screens

## Summary

Successfully created two new screens for the MartUp e-commerce app: **DepositHistoryScreen** and **DepositDetailScreen**.

## Files Created/Modified

### New Files
1. **`/home/z/my-project/src/components/ecommerce/screens/deposit-history-screen.tsx`** — Deposit history list with status filter tabs
2. **`/home/z/my-project/src/components/ecommerce/screens/deposit-detail-screen.tsx`** — Individual deposit detail with proof upload flow

### Modified Files
3. **`/home/z/my-project/src/lib/types.ts`** — Added `'deposit-history' | 'deposit-detail'` to `ScreenName` type
4. **`/home/z/my-project/src/lib/store/types.ts`** — Added `selectedDepositId: string | null` and `setSelectedDeposit: (id: string | null) => void` to `SelectionSlice`
5. **`/home/z/my-project/src/lib/store/selection.ts`** — Implemented `selectedDepositId` and `setSelectedDeposit` in the slice creator
6. **`/home/z/my-project/src/components/ecommerce/screens/index.ts`** — Exported both new screens
7. **`/home/z/my-project/src/components/ecommerce/screen-registry.tsx`** — Registered lazy-loaded components, screen map entries, and added to SUB_SCREENS

## Features Implemented

### DepositHistoryScreen
- Fetches deposits from `GET /api/wallet/deposits` with pagination
- Status filter tabs (Semua, Pending, Verifikasi, Berhasil, Gagal, Kadaluarsa)
- Each deposit item shows amount, method icon+label, status badge, relative time, arrow icon
- Click navigates to `deposit-detail` screen with `selectedDepositId` set in store
- Pull-to-refresh (refetch), load more pagination
- Empty state when no deposits
- Method icons (emoji-based) with color coding
- Status colors: pending=amber, proof_uploaded=cyan, success=emerald, failed=red, expired=gray

### DepositDetailScreen
- Fetches deposit detail from deposits list (finds by `selectedDepositId`)
- Status-specific hero icons (CheckCircle2, XCircle, Clock)
- Amount displayed prominently
- Status badge with color coding
- Expiry countdown timer (animated) for pending/proof_uploaded
- Destination account info with copy-to-clipboard buttons
- Upload proof section with file picker (image only), sender name input, upload button
- Two-step upload: image to Supabase via `/api/upload`, then proof URL to `/api/wallet/deposits/[id]/proof`
- Upload success message with "Kembali ke Riwayat" button
- Proof uploaded state: shows proof image + waiting for verification
- Failed state: shows rejection reason (admin note)
- Expired state: shows "Buat Top Up Baru" button → navigates to deposit screen
- Admin note display for failed/proof_uploaded statuses

## Verification
- ESLint: 0 errors (3 pre-existing warnings in unrelated file)
- Dev server: Running successfully on port 3000
