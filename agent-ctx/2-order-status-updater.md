# Task 2 - Order Status Updater

## Task: Update order-status.ts for service order support

## Work Done

1. Updated comment block at top of file to document both service and physical order flows
2. Modified `getCommissionRate()` to accept `isServiceOrder` parameter:
   - Reads `serviceCommissionRate` from PlatformSetting for service orders
   - Falls back to `commissionRate` if `serviceCommissionRate` not configured
   - Default rate: 0.08 (8%) for service orders, 0.05 (5%) for physical
3. Added `serviceProofImages?: string[]` param to `updateOrderStatus` function signature
4. Updated shipped status validation to be conditional on `isServiceOrder`:
   - Service orders: require `serviceProofImages` (proof images array)
   - Physical orders: require `trackingNumber` (tracking number string)
5. Updated shipped status transaction logic for service orders:
   - Sets `serviceProofImages` as JSON string
   - Sets `sellerCompletedAt` to current time
   - Sets `autoConfirmAt` to now + 72 hours (3 days)
   - Skips Shipping record update (service orders may not have one)
6. Updated delivered status transaction logic for service orders:
   - Sets `buyerConfirmedAt` to current time
   - Shipping update skipped if no shipping record exists (already conditional on `order.shipping`)
7. Updated escrow release logic in delivered handler to use `getCommissionRate(isServiceOrder)` with proper default rate fallback
8. Updated escrow reversal in cancelled handler to use service commission rate for service orders
9. Updated notification messages for service order "shipped" status:
   - Buyer: "Jasa Selesai" with auto-confirm notice
   - Seller: "Jasa Ditandai Selesai" with 3-day auto-confirm notice
10. Added cron job hint comments near `autoConfirmAt` assignment
11. Added `isServiceOrder` to the success log info

## Verification
- Lint passes ✅
- Dev server compiles ✅
