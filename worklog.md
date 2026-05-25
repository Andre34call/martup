---
Task ID: 1
Agent: main
Task: Fix "Terjadi Kesalahan" error when switching to seller mode

Work Log:
- Investigated the error by tracing it to ErrorBoundary component which catches all React crashes
- Found ROOT CAUSE: `SellerDashboard` and `SellerAnalytics` components destructure `sellerStats` and `fetchSellerStats` from the Zustand store, but these properties didn't exist in the store
- `fetchSellerStats()` was being called in useEffect, causing `TypeError: undefined is not a function` → ErrorBoundary caught it → "Terjadi Kesalahan"
- Also found: `switchRole('seller')` didn't auto-register a seller record when buyer switches to seller
- Also found: Wallet model missing `pendingBalance` field referenced in `fetchUserData`

Fixes Applied:
1. **store.ts**: Added `sellerStats: SellerStats | null` and `fetchSellerStats: () => Promise<void>` to AppState interface and store implementation
2. **store.ts**: `fetchSellerStats` gracefully returns early if no seller ID, fetches from `/api/seller/stats` when available
3. **store.ts**: `switchRole('seller')` now auto-registers seller via `/api/seller/register` API if no seller record exists
4. **store.ts**: Added `sellerStats: null` to logout and deleteAccount resets
5. **seller/stats/route.ts**: Enhanced recentOrders response to include buyerName, shipping, items with full shape for frontend compatibility
6. **prisma/schema.prisma**: Added `pendingBalance Float @default(0)` to Wallet model
7. Ran `bun run db:push` to sync schema changes
8. All lint checks pass, dev server compiles without errors

Stage Summary:
- Seller mode switching now works without crashing
- Auto-registration creates seller record when buyer switches to seller
- Seller dashboard loads with fallback stats even before API data arrives
- Wallet pendingBalance field now properly stored in database
