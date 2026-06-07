# Task 26: p0-financial-fix

## Summary
Fixed 4 critical P0 financial bugs and verified 3 more were already fixed by prior agents.

## Files Modified
1. `src/lib/order-status.ts` - Escrow release over-credit fix
2. `src/app/api/seller/withdraw/route.ts` - Double-withdrawal race condition fix
3. `src/app/api/payment/create/route.ts` - Math.round → Math.floor for Midtrans payload
4. `src/app/api/orders/route.ts` - Shipping cost manipulation prevention

## Files Verified (already fixed, no changes needed)
1. `src/app/api/wallet/debit/route.ts` - Atomic updateMany already in place
2. `src/app/api/wallet/debit-batch/route.ts` - Atomic updateMany already in place
3. `src/app/api/payment/notification/route.ts` - Math.round(Number()) comparison already in place

## Key Changes
- Escrow release now uses same `releaseAmount` for both pendingBalance decrement and balance increment
- Withdrawal uses atomic `updateMany` with `balance >= amount` where clause
- Midtrans item_details uses `Math.floor` consistently (matching order creation)
- Shipping cost fallback rejects suspiciously low client values (< 5000) for non-service orders

## Verification
- `bun run lint` passes with no errors
