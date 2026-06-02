# Task 7b - Admin Orders Payment Verification

## Summary
Added payment verification support to the admin orders page for orders with `paymentStatus === 'pending_verification'`.

## Files Modified

### 1. `src/lib/types.ts`
- Added 5 new fields to `Order` interface: `paymentProofUrl`, `platformBankAccountId`, `escrowStatus`, `note`, `platformBankAccount`
- Added new `PlatformBankAccountInfo` interface

### 2. `src/lib/mappers.ts`
- Updated `mapOrder` to map all new fields from raw API data
- Maps `platformBankAccount` relation data to `PlatformBankAccountInfo` type

### 3. `src/app/api/admin/orders/route.ts`
- Added `platformBankAccount` to Prisma include clause in GET handler
- Selects: id, bankName, bankCode, accountNumber, accountHolder, branch, isActive, isDefault

### 4. `src/components/ecommerce/admin-orders-screen.tsx` (major rewrite)
- **Payment verification section**: Expandable "Bukti Transfer Pembeli" for pending_verification orders
  - Shows payment proof image (tap to open full size)
  - Displays sender info parsed from note field (JSON or plain text)
  - Shows platform bank account details
  - "Terima Pembayaran" (approve) and "Tolak" (reject) action buttons
  - Expandable admin note input for rejection reason
  - Calls PUT `/api/admin/orders/[orderId]/verify-payment`
- **Escrow status badges**: none (gray), held (amber), released (green), refunded (red)
- **Payment status filter**: Second row of filter chips (all/unpaid/pending_verification/paid/failed)
- **Payment status badges**: Shown inline on each order card
- **Summary card update**: "Perlu Verif" card replaces "Diproses" in summary grid
- **Action button logic**: Hidden for pending_verification orders

## Verification
- Lint passes ✅
- Dev server compiles ✅
