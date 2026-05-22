# Task 7-8: Fix Admin Dashboard & Admin Orders to Use Real Store Data

## Summary
Fixed both Admin Dashboard and Admin Orders screens to use real data from the Zustand store instead of hardcoded mock values.

## Changes Made

### File 1: `/home/z/my-project/src/components/ecommerce/admin-screens.tsx`
**AdminDashboard component:**
1. Added `withdrawRequests` to the `useAppStore()` destructuring
2. Replaced hardcoded `count: 23` in "Permintaan Penarikan" with `withdrawRequests.filter(w => w.status === 'pending').length`
3. Kept mock counts for "Verifikasi Seller" (5), "Laporan Produk" (3), and "Keluhan Terbuka" (8) as specified

### File 2: `/home/z/my-project/src/components/ecommerce/admin-orders-screen.tsx`
**AdminOrdersScreen component:**
1. Removed the `mockAdminOrders` constant (100+ lines of mock data)
2. Removed local `orders` state (`useState(mockAdminOrders)`)
3. Added `useMemo` import; mapped store orders using `mapStoreOrderToAdminOrder()`
4. Destructured `orders: storeOrders` from `useAppStore()`
5. Added `mapToAdminStatus()` function to map `OrderStatus` → `AdminOrderStatus`:
   - `pending` → `pending`
   - `paid` → `processing`
   - `processing` → `processing`
   - `shipped` → `shipped`
   - `delivered` → `delivered`
   - `cancelled` → `cancelled`
   - `refunded` → `cancelled`
6. Added `mapStoreOrderToAdminOrder()` function to map store `Order` to display `AdminOrder`:
   - `orderNumber` from store
   - `buyerName` = "Buyer" placeholder
   - `items` mapped from `order.items` (`{ name: i.productName, quantity: i.quantity }`)
   - `totalAmount` from store
   - `status` mapped via `mapToAdminStatus()`
   - `date` formatted via `formatDate(order.createdAt)`
   - `paymentMethod` from store or 'COD' fallback
7. Removed all `setOrders()` calls from action handlers - store `updateOrderStatus()` now handles state updates directly
8. Added `formatDate` import from `@/lib/mock-data`
9. Added `Order` type import from `@/lib/types`
10. Kept `AdminOrderStatus` type and all UI status mappings (icons, colors, actions) intact

## Verification
- `bun run lint` passed with no errors
- Dev server compiling successfully
