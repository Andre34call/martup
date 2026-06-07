# Task 3-a: P1 Bug Fix Agent

## Summary
Fixed 3 P1 bugs: unified isCodOrder() imports, fixed voucher rounding drift, and fixed multi-seller break on close.

## Changes

### P1-3: Unify isCodOrder() — Import from payment-utils.ts
- **order.ts**: Replaced inline COD check with `isCodOrder(order)` (import was already present)
- **order-screen.tsx**: Removed 4 local payment utility functions, added import from `@/lib/payment-utils`, replaced inline `isMidtransPayment` with `isMidtransPaymentUtil(order)`
- **checkout-screen.tsx**: Removed local `extractPaymentReference` (50 lines), added import from `@/lib/payment-utils`

### P1-5: Fix Voucher Discount Rounding Drift
- **checkout-screen.tsx**: Changed `Math.round` → `Math.floor` for `groupDiscount` calculation to match server rounding

### P1-8: Fix Multi-Seller Break on Close
- **checkout-screen.tsx**: Added cart item removal when user closes Snap popup (orders already exist in DB)

## Verification
- `bun run lint` passes with no errors
- Dev server running on port 3000
