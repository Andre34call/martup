# Task 1a+1b: Fix Midtrans Payment Reference Display
# Agent: full-stack-developer
# Status: COMPLETED

## Summary
Fixed the critical issue where Midtrans payment references (VA numbers, payment codes, QR URLs) were lost after the Snap popup closed. Now buyers can see their payment reference in the order detail screen.

## Changes Made

### A. Prisma Schema (prisma/schema.prisma)
- Added `paymentReference String?` field to Order model
- DB push completed successfully

### B. Frontend Types & Mappers (lib/types.ts, lib/mappers.ts)
- Added `paymentReference?: string` to Order interface and RawOrder interface
- Added mapping in `mapOrder()` function

### C. Checkout Flow (checkout-screen.tsx)
- Created `extractPaymentReference()` function (exported) to extract payment data from Snap result
- After Snap returns `pending`, saves reference via `/api/payment/save-reference` API
- New API endpoint created: `src/app/api/payment/save-reference/route.ts`

### D. Webhook (api/payment/notification/route.ts)
- On `pending` notification, extracts VA numbers, payment codes, bill key/biller code
- Saves as JSON to `order.paymentReference`

### E. Order Detail Display (order-screen.tsx)
- Added "Cara Pembayaran" section with:
  - VA number display with copy button
  - Payment code display with copy button
  - Mandiri Bill display with copy buttons
  - QR Code URL with open button
  - E-Wallet deep links
  - Step-by-step payment instructions
  - "Bayar Sekarang" button to re-open Snap popup
- Added `parsePaymentReference()`, `getPaymentTypeLabel()` helpers

### F. Re-payment Token Reuse (api/payment/create/route.ts)
- Added Step 8.5: checks Midtrans transaction status API for existing pending transaction
- If still pending with valid token, reuses existing token instead of creating new one
- Prevents duplicate VA numbers on repeated payment attempts

### G. Notification URL (api/payment/create/route.ts)
- Added `notification_url` to Snap payload callbacks

### H. DB Push Script Fix (scripts/db-push.sh)
- Added `SUPABASE_DIRECT_URL` env var to prisma db push command

## Verification
- `bun run lint`: 0 errors
- `npx next build`: Compiled successfully
- `prisma db push`: Schema synced
