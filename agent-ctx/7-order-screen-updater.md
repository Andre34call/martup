# Task 7: Update order screen UI for service orders

## Summary
Updated `src/components/ecommerce/order-screen.tsx` to properly handle service orders with distinct UI from physical orders.

## Key Changes

### New Constants & Helpers
- `SERVICE_STATUS_LABELS` — overrides for processing/shipped/delivered status labels
- `STATUS_STYLES` / `DEFAULT_STATUS_LABELS` — maps for custom badge rendering
- `SERVICE_TRACKING_STEPS` — service-specific timeline steps with Wrench/ShieldCheck icons
- `getStatusLabel(order)` — returns service-specific or default status label
- `computeTimeLeft(autoConfirmAt)` — computes days/hours/minutes remaining
- `AutoConfirmCountdown` — live countdown component (updates every 60s)
- `ServiceAwareStatusBadge` — renders custom badge for service orders, falls back to shared StatusBadge

### OrderCard Changes
- "JASA" badge with Wrench icon next to store name (when `order.isServiceOrder`)
- ServiceAwareStatusBadge instead of plain StatusBadge
- Secondary button: "Konfirmasi" for service orders (was "Terima")
- Primary button for shipped: "Detail" for service orders (was "Lacak")
- Toast messages adjusted for service orders

### OrderDetail Changes
- Status banner: service-aware icons (Wrench/ShieldCheck), AutoConfirmCountdown, conditional estimated days
- Processing notice: "Seller sedang mengerjakan jasa Anda" with service duration from product lookup
- Proof images gallery with modal preview for shipped service orders
- Tracking timeline hidden for service orders
- Shipping address hidden for service orders
- Shipping cost shows "Tanpa Pengiriman" for service orders
- Order info: service-specific date fields (sellerCompletedAt, buyerConfirmedAt)
- "Konfirmasi Selesai" button for service orders (was "Konfirmasi Diterima")
- "Laporkan Masalah" button navigates to refund screen
- Proof image modal dialog

## Verification
- Lint passes ✅
- Dev server compiles and renders ✅
- All physical order functionality preserved
