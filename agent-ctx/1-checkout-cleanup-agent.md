# Task 1 - Checkout Cleanup Agent

## Task
Remove bank_transfer/escrow payment method, fix UI bugs, and update API error message

## Changes Made

### 1. checkout-screen.tsx
- Removed `bank_transfer` from PAYMENT_METHODS array (was the "Transfer Bank" option with Building2 icon)
- Removed 3 state variables: `escrowBankAccounts`, `isLoadingBankAccounts`, `copiedAccountId`
- Removed useEffect that fetched bank accounts from `/api/settings/bank-accounts`
- Removed `handleCopyAccountNumber` function
- Removed `bank_transfer` branch in `handlePay` (lines 890-908 original)
- Removed "Bank Account Info" JSX section (~60 lines of bank account display)
- Removed `teal` color mapping from payment method icon rendering
- Changed "ditahan (escrow)" to "ditahan" in jasa service notice
- Fixed bottom CTA bar: `fixed bottom-0 left-0 right-0` → `fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-[480px]`
- Removed inner `mx-auto max-w-[430px]` wrapper div
- Fixed quantity auto-increment bug: `whileTap={{ scale: 0.9 }}` → `whileHover={{ scale: 1.05 }}` on +/- buttons
- Cleaned up imports: removed `Building2`, `Landmark`, `Copy`, `CheckCircle`

### 2. cart-screen.tsx
- Same bottom bar width fix as checkout
- Removed inner wrapper div, moved children up

### 3. order-screen.tsx
- Removed `escrowBankAccounts` state
- Removed `isUploadingProof` state
- Removed `isEscrowOrder` variable
- Removed `fetchBankAccounts` callback + its useEffect
- Removed `handleUploadPaymentProof` function (~50 lines)
- Removed escrow/bank_transfer check in OrderCard's "Bayar" button handler
- Removed "Pembayaran Transfer" section (bank account display + upload proof)
- Removed proof image display section for escrow orders
- Merged `isEscrowOrder`-conditional action buttons into single unified conditions
- Cleaned up imports: removed `Landmark`, `Upload`, `ImagePlus`, `CheckCircle`, `Landmark as BankIcon`

### 4. payment/create/route.ts
- Changed error message: removed "Silakan gunakan metode Transfer Bank atau" from the Midtrans not configured error

## Verification
- `bun run lint` passes with no errors
- Dev server running correctly
