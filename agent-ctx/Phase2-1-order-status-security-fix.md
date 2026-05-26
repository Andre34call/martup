# Phase2-1 Order Status Security Fix Agent

## Task
Rewrite /api/orders/[id]/status/route.ts to add authentication, authorization, rate limiting, transaction safety, and proper escrow logic.

## Work Done

### Critical Security Fix
The original route had ZERO authentication — anyone could call the endpoint to change order status, trigger escrow releases, refunds, and stock restoration.

### Changes Made
1. **Added verifyAuth** — All requests must be authenticated via NextAuth session or HMAC-signed bearer token
2. **Added checkRateLimit** — 10 status updates per minute per user
3. **Added ownership/role verification**:
   - Only seller can set: processing, shipped
   - Only buyer can set: delivered (confirm receipt)
   - Only admin can set: cancelled, paid
   - Buyers can cancel their own order if still pending
4. **Validated state transitions** — Defined VALID_TRANSITIONS map with allowed from→to status changes
5. **Used $transaction for all financial operations**:
   - Escrow release on delivered (moves pendingBalance→balance for seller)
   - Refund on cancelled (credits buyer wallet, deducts seller pendingBalance)
   - Stock restoration on cancelled (increments product/variant stock, decrements sold)
6. **Used serializeDecimal** for all Decimal fields in response
7. **Added proper logging** via logger for status changes, auth failures, and errors
8. **Used PlatformSetting for commission rate** — reads from db.platformSetting.findUnique where key='platform_settings', falls back to seller's commissionRate then 0.05 default
9. **Created notifications for both buyer and seller** on all status changes
10. **Validated cancelReason** when status is 'cancelled' (required, max 500 chars)
11. **Validated trackingNumber** when status is 'shipped' (required, max 100 chars)

### State Transitions (Secure)
- pending → cancelled (buyer or admin)
- pending → paid (admin only)
- paid → processing (seller only)
- paid → shipped (seller only, requires trackingNumber)
- paid → cancelled (admin only)
- processing → shipped (seller only, requires trackingNumber)
- shipped → delivered (buyer only, triggers escrow release)
- shipped → cancelled (admin only, triggers refund)

### Files Changed
- `/home/z/my-project/src/app/api/orders/[id]/status/route.ts` — Complete rewrite

### Verification
- `bun run lint` — 0 errors, 0 warnings
- Dev server running cleanly
