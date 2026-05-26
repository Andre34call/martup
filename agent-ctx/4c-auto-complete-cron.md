# Task 4c - Auto-Complete Shipped Orders Cron Job

## Work Log

- Read worklog.md and understood previous agent work (Phases 1-4 complete, P1 critical fixes done)
- Read existing cancel-expired cron pattern at `/src/app/api/cron/cancel-expired/route.ts`
- Read payment notification handler to understand escrow crediting logic (pendingBalance on payment confirmation)
- Read Prisma schema for Order, Shipping, Seller, Wallet, WalletMutation, Notification models
- Read logger.ts and decimal-utils.ts for utility patterns

### Created `/src/app/api/cron/auto-complete/route.ts`
- Follows exact same pattern as cancel-expired (auth, rate limiting, structure)
- `verifyCronAuth()` with CRON_SECRET and timing-safe comparison
- `checkCronRateLimit()` with in-memory rate limit (1 call/minute)
- Configurable `AUTO_COMPLETE_DAYS` from env var (default 7)
- Core logic: `autoCompleteShippedOrders()`
  - Finds orders with `status: 'shipped'` AND `shippedAt < cutoffDate`
  - For each qualifying order, in a Prisma transaction:
    a. Updates order status to `delivered`, sets `deliveredAt: new Date()`
    b. Updates Shipping status to `delivered`, sets `deliveredAt: new Date()`
    c. Releases escrow: idempotency check via `order_release` WalletMutation
       - Calculates: subtotal * (1 - commissionRate) = sellerEarnings
       - Finds or creates seller Wallet
       - Decrements `pendingBalance`, increments `balance` (availableBalance)
       - Creates WalletMutation (credit, refType: 'order_release', refId: order.id)
    d. Creates Notification for buyer: "Pesanan Selesai"
    e. Creates Notification for seller: "Dana Diterima"
  - Logs business events for each auto-completed order
- Supports both GET (Vercel Cron) and POST (manual trigger)

### Created `/src/app/api/cron/auto-complete-stuck/route.ts`
- Same auth and rate limiting pattern as cancel-expired
- Configurable `STUCK_PROCESSING_DAYS` from env var (default 3)
- Core logic: `remindStuckProcessingOrders()`
  - Finds orders with `status: 'processing'` AND `updatedAt < cutoffDate`
  - For each, creates a notification for the seller: "Segera Kirim Pesanan"
  - Does NOT auto-cancel or change status — just reminds
  - Logs business events for each reminder sent
- Supports both GET (Vercel Cron) and POST (manual trigger)

### Updated `/home/z/my-project/vercel.json`
- Added cron schedules:
  - `/api/cron/cancel-expired` → `0 * * * *` (every hour, unchanged)
  - `/api/cron/auto-complete` → `0 */6 * * *` (every 6 hours)
  - `/api/cron/auto-complete-stuck` → `0 9 * * *` (daily at 9am)

### Fixed pre-existing lint error
- Fixed unterminated string literal in `/src/lib/shipping-calculator.ts` line 484
  - Changed `{ component: 'shipping, ...` to `{ component: 'shipping', ...`

### Lint check
- `bun run lint` passes with 0 errors, 0 warnings
- Dev server running cleanly
