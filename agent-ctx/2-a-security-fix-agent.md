# Task 2-a: Security Fix Agent (Round 3)

## Task
Fix remaining security issues (SG-5, SG-7, SG-8)

## Previous Agent Context
- Agent 1-d created `/src/lib/order-status.ts` with shared `updateOrderStatus()` function
- Agent 1-a added server-side price verification to `/api/orders/route.ts` including voucher validation
- Agent 1-c fixed SG-4 (email enumeration on register) — same anti-enumeration pattern used for SG-8

## Changes Made

### SG-5: Midtrans refund on order cancellation
- **New file:** `/src/lib/midtrans-server.ts`
  - `requestMidtransRefund(orderId, amount?, reason?)` → POST /v2/{order_id}/refund
  - Basic auth with MIDTRANS_SERVER_KEY
  - Sandbox/production support via MIDTRANS_IS_PRODUCTION
  - Graceful handling when MIDTRANS_SERVER_KEY not configured
- **Updated:** `/src/app/api/orders/[id]/cancel/route.ts`
  - After DB transaction: if paid via Midtrans (paymentMethod !== 'wallet'), calls requestMidtransRefund()
  - Best-effort: logs outcome but doesn't fail cancellation
- **Updated:** `/src/lib/order-status.ts`
  - Added `paymentStatus: 'refunded'` when cancelling paid order (was missing)
  - Added Midtrans refund call after transaction for cancelled+paid+non-wallet orders

### SG-7: Voucher race condition protection
- **Updated:** `/src/app/api/vouchers/validate/route.ts`
  - Added comment: this is a PREVIEW endpoint, actual consumption in order creation
  - Added near-limit warning when usageLimit - usageCount <= 3
- **Updated:** `/src/app/api/orders/route.ts`
  - After VoucherUsage create + usageCount increment: re-reads voucher, checks usageCount <= usageLimit
  - If exceeded, throws error to roll back entire transaction

### SG-8: OTP auto-creates accounts
- **Updated:** `/src/app/api/auth/otp/send/route.ts`
  - Removed user auto-creation block (was creating user + wallet for unregistered phones)
  - Now returns generic message: "Jika nomor HP terdaftar, kode OTP akan dikirim ke {masked}"
  - Prevents unlimited fake account creation
  - Users must register via /api/auth/register first

## Verification
- `bun run lint` passes clean (no ESLint errors)
