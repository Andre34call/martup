# Task 1 - Shared Utils Agent

## Task
Create shared utility files to prevent accidental feature deletion and improve maintainability.

## Files Created

1. **`/src/lib/payment-utils.ts`** — Payment-related shared utilities
   - `isCodOrder(order)` — Check if order is Cash on Delivery
   - `isMidtransPayment(order)` — Check if order uses Midtrans payment
   - `extractPaymentReference(result)` — Extract VA number, payment code from Snap result
   - `parsePaymentReference(refString)` — Parse payment reference JSON
   - `getPaymentMethodLabel(paymentMethod)` — Human-readable label for payment method
   - `getPaymentTypeLabel(paymentType)` — Display label for Midtrans payment_type

2. **`/src/lib/constants.ts`** — Added new constants
   - `MAX_CART_QUANTITY = 99`
   - `ORDER_EXPIRY_HOURS = 24`
   - `DEFAULT_PLATFORM_FEE = 1000`
   - `SNAP_POPUP_TIMEOUT_MS = 600000`

3. **`/src/lib/process-seller-payout.ts`** — Shared seller payout processor
   - `processSellerPayout(input)` — Idempotent seller payout with wallet find-or-create, pending balance credit, wallet mutation, commission transaction, buyer + seller notifications

4. **`/src/lib/db-includes.ts`** — Shared Prisma include objects
   - `cartItemInclude` — Unified cart item include (product with seller, category, variants + variant)
   - `orderDetailInclude` — Order response include (items with product/variant, shipping, seller)
   - `orderWithSellerPayoutInclude` — Payout route include (items, seller with commissionRate, user)

## Status
Completed. All 4 files created, worklog updated, lint passes.
