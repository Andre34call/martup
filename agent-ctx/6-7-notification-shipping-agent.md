# Tasks 6 & 7: Fix originCity Hardcoding + Add Notification Fetching with Polling

## Work Log

### Task 6: Fix originCity Hardcoded "Jakarta" → Use Seller's Store City

**Problem**: In `checkout-screen.tsx`, line 307, the shipping origin city was hardcoded to "Jakarta" regardless of the seller's actual location.

**Changes made**:

1. **`prisma/schema.prisma`** — Added `storeCity String?` field to the Seller model. Pushed schema to database with `bun run db:push`.

2. **`src/lib/types.ts`** — Added `storeCity?: string` to the `Seller` interface, so the TypeScript type includes the new field.

3. **`src/components/ecommerce/checkout-screen.tsx`** — Three changes:
   - Updated `fetchShippingRates` callback signature to accept an optional `originCity` parameter: `fetchShippingRates(sellerId, destinationCity, weightGrams, originCity?)`
   - Changed the body from `originCity: 'Jakarta'` to `originCity: originCity || 'Jakarta'` — uses seller's store city with Jakarta fallback
   - Updated both auto-fetch effects to pass `group.seller.storeCity` as the originCity argument when calling `fetchShippingRates`

4. **`src/lib/store/data-fetch.ts`** — Updated seller mapping in `fetchUserData`:
   - Added `storeAddress: data.seller.storeAddress || undefined` to the main seller mapping
   - Added `storeCity: data.seller.storeCity || undefined` to the main seller mapping
   - Added `storeCity: o.seller.storeCity || undefined` to the order seller mapping

### Task 7: Add Notification Fetching from API with Polling

**Problem**: The notification screen only showed notifications from the Zustand store, but notifications were never fetched from the API independently.

**Changes made**:

1. **`src/lib/store/types.ts`** — Added `fetchNotifications: (userId: string) => Promise<void>` to the `NotificationSlice` interface.

2. **`src/lib/store/notification.ts`** — Added `fetchNotifications` method that:
   - Fetches from `/api/notifications?userId=...` with auth headers
   - Maps API response to local notification objects (id, title, content, type, isRead, createdAt, actionUrl)
   - Sets `notifications` and recalculates `unreadNotificationCount`
   - Logs errors via `logger.warn` without crashing

3. **`src/components/ecommerce/notification-screen.tsx`** — Two changes:
   - Added `useEffect` to fetch notifications on mount when `currentUser?.id` is available
   - Added `useEffect` with `setInterval` to poll for new notifications every 60 seconds, with cleanup on unmount
   - Added `useEffect` import and `fetchNotifications`/`currentUser` to the store destructuring

4. **`src/lib/store/data-fetch.ts`** — Added `get().fetchNotifications(userId)` call in `fetchUserData` so notifications are loaded on login alongside other user data.

## Verification
- `bun run lint` passes with 0 errors, 0 warnings
- Dev server running cleanly, page loads successfully
- Schema pushed to database successfully
