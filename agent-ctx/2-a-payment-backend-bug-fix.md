# Task 2-a: Payment Backend Bug Fix Agent

## Task
Fix 3 critical (P0) bugs in the payment backend.

## Files Modified
1. `/home/z/my-project/src/app/api/payment/notification/route.ts` — P0-1: Webhook signature key bypass
2. `/home/z/my-project/src/app/api/payment/create/route.ts` — P0-4: Auto-cancel during payment attempt
3. `/home/z/my-project/src/app/api/payment/save-reference/route.ts` — P0-5: Missing status validation

## Changes Summary

### P0-1: Fix Webhook Signature Key Bypass
- Replaced `const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ''` with `import { MIDTRANS_SERVER_KEY } from '@/lib/midtrans-config'`
- Ensures webhook uses the same auto-detected key as payment creation endpoint
- Prevents sandbox/production key mismatch that would cause signature verification failures

### P0-4: Fix Auto-Cancel During Payment Attempt
- Added safety check before auto-cancelling expired orders
- Checks for recent (within 5 minutes) pending Transaction record
- If found, returns 409 instead of auto-cancelling
- Prevents race condition where two tabs try to pay/cancel simultaneously

### P0-5: Add Status Validation on Save-Reference Endpoint
- Added order status check: only allows saving when `status === 'pending'` AND `paymentStatus in ['unpaid', 'pending']`
- Added JSON validation: paymentReference must parse to a non-null, non-array object
- Prevents overwriting paymentReference on already-paid orders with arbitrary JSON

## Verification
- `bun run lint` passes with no errors
