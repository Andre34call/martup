# Task 16: Refactor order-screen.tsx into order/ folder structure

## Summary
Successfully refactored the monolithic `order-screen.tsx` (~1323 lines) into a folder-based structure with smaller, focused files.

## Files Created

1. **`src/components/ecommerce/order/types.ts`** (27 lines)
   - `PaymentRefData` interface — typed wrapper for payment reference data
   - `ServiceProofData` interface — service proof API response type

2. **`src/components/ecommerce/order/ServiceProofSection.tsx`** (102 lines)
   - `ServiceProofCountdown` component — auto-confirm countdown timer (exported for use by OrderCard)
   - `ServiceProofSection` component — proof images display with auto-confirm countdown notice

3. **`src/components/ecommerce/order/PaymentReferenceDisplay.tsx`** (202 lines)
   - `PaymentReferenceDisplay` component — VA numbers, payment codes, QR URLs, Mandiri bill, e-wallet deep links, payment instructions, and "Bayar Sekarang" button

4. **`src/components/ecommerce/order/OrderCard.tsx`** (310 lines)
   - `getActionButton` helper — determines primary action button per order status
   - `getSecondaryButton` helper — determines secondary action button
   - `OrderCard` component — order card for list view with status badge, items, actions, cancel dialog

5. **`src/components/ecommerce/order/OrderDetail.tsx`** (647 lines)
   - `TRACKING_STEPS` / `SERVICE_TRACKING_STEPS` — timeline step configs
   - `getActiveStep` helper — maps order status to timeline step index
   - `OrderDetail` component — full order detail view composing ServiceProofSection and PaymentReferenceDisplay
   - Uses `extractPaymentReference` (from `@/lib/payment-utils`) instead of dynamic import from checkout-screen

6. **`src/components/ecommerce/order/OrderScreen.tsx`** (125 lines)
   - `ORDER_TABS` / `tabStatusMap` — tab configuration
   - `OrderScreen` component — main orchestrator with tab switching, list vs detail view

7. **`src/components/ecommerce/order/index.ts`** (1 line)
   - Re-exports `OrderScreen`

## Files Modified

1. **`src/components/ecommerce/screen-registry.tsx`**
   - Changed import: `import('@/components/ecommerce/order-screen')` → `import('@/components/ecommerce/order')`

## Key Design Decisions

- **Shared types in `types.ts`**: `PaymentRefData` and `ServiceProofData` are used by multiple components, so they live in a shared types file
- **ServiceProofCountdown exported from ServiceProofSection**: Used by both OrderCard (mini preview) and ServiceProofSection (full view)
- **PaymentReferenceDisplay is self-contained**: Receives `onPayNow` and `showToast` as props for clean separation
- **extractPaymentReference used directly**: In the original file, the "Bayar Sekarang" handler in OrderDetail dynamically imported `extractPaymentReference` from checkout-screen. The refactored version imports it directly from `@/lib/payment-utils` (which was the shared utility created in Task 1), eliminating the circular dependency concern
- **Original order-screen.tsx preserved**: Not deleted as instructed — will be removed after verification

## Line Count Comparison

| File | Lines |
|------|-------|
| order/types.ts | 27 |
| order/ServiceProofSection.tsx | 102 |
| order/PaymentReferenceDisplay.tsx | 202 |
| order/OrderCard.tsx | 310 |
| order/OrderDetail.tsx | 647 |
| order/OrderScreen.tsx | 125 |
| order/index.ts | 1 |
| **Total** | **1414** |
| Original order-screen.tsx | 1323 |

The slight increase is due to import statements and prop interfaces in each file — expected for self-contained components.

## Verification

- `bun run lint` passes with no errors
- No other files import from `order-screen` directly (only screen-registry.tsx, which was updated)
