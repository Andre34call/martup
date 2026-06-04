# Task ID: cron-fixes
# Agent: code

## Task: Fix HIGH priority bugs in cron jobs (RC1, RH1, RH2, RH3)

## Work Log:

### RC1 — Auto-complete cron uses raw commissionRate
**Problem**: `auto-complete/route.ts` line 144 used `Number(order.seller.commissionRate)` directly, ignoring the platform-wide commission rate from PlatformSettings.
**Fix**: Refactored the entire auto-complete cron to use `updateOrderStatus()` which internally calls `getEffectiveCommissionRate()` for correct commission calculation.

### RH1 — Auto-complete cron doesn't increment seller totalSales
**Problem**: The auto-complete cron never called `tx.seller.update({ data: { totalSales: { increment: 1 } } })`, causing inaccurate seller statistics.
**Fix**: By refactoring to use `updateOrderStatus()`, seller totalSales is now incremented automatically (order-utils.ts line 305-308 handles this).

### RH2 — Auto-complete cron ignores autoCompleteDays from PlatformSettings
**Problem**: The auto-complete cron hardcoded `AUTO_COMPLETE_DAYS` from an env variable (`process.env.AUTO_COMPLETE_DAYS || '7'`), ignoring the PlatformSettings table.
**Fix**: Added `getPlatformConfig()` function (matching pattern from cancel-expired cron) that reads `autoCompleteDays` from the `platform_settings` key in PlatformSettings table with a 7-day default fallback.

### RH3 — Cancel-expired cron updates paymentStatus outside the transaction
**Problem**: The cancel-expired cron called `updateOrderStatus()` (which runs in a transaction), then separately did `db.order.update({ data: { paymentStatus: 'expired' } })` OUTSIDE that transaction, creating a race condition.
**Fix**: 
1. Added `paymentStatusOverride?: string` parameter to `UpdateOrderStatusParams` interface in order-utils.ts
2. In the `updateOrderStatus()` transaction, when `newStatus === 'cancelled'` and `paymentStatusOverride` is provided, the paymentStatus is now set inside the same transaction
3. Updated cancel-expired cron to pass `paymentStatusOverride: 'expired'` to `updateOrderStatus()`
4. Removed the separate `db.order.update()` call that was outside the transaction

## Files Modified:
1. `/home/z/my-project/src/app/api/cron/auto-complete/route.ts` — Major refactor to use `updateOrderStatus()` + `getPlatformConfig()`
2. `/home/z/my-project/src/app/api/cron/cancel-expired/route.ts` — Pass `paymentStatusOverride: 'expired'`, remove out-of-transaction update
3. `/home/z/my-project/src/lib/order-utils.ts` — Add `paymentStatusOverride` param to interface and apply inside transaction

## Verification:
- Targeted lint on all 3 modified files passes ✅
- Full lint fails on pre-existing error in chat/rooms/route.ts (owned by other agent, not modified)
