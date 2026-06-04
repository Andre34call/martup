# Task 7 - Fix Hardcoded Buyer Name in Admin Orders

## Summary
Fixed the hardcoded `buyerName: 'Buyer'` in admin-orders-screen.tsx by creating a dedicated admin orders API endpoint that includes buyer name from the User relation, and wiring it through the store to the component.

## Changes Made

### 1. New API Endpoint: `/src/app/api/admin/orders/route.ts`
- Created GET endpoint that fetches all orders with `user` relation included
- Adds `buyerName` field derived from `order.user?.name || 'Unknown'`
- Supports optional `status`, `page`, and `limit` query params
- Includes items, product images, shipping, and seller relations
- Returns pagination metadata

### 2. Type Update: `/src/lib/types.ts`
- Added optional `buyerName?: string` field to the `Order` interface

### 3. Store Updates: `/src/lib/store.ts`
- Added `adminOrders: Order[]` state (separate from `orders` which is user-specific)
- Added `fetchAdminOrders()` async method that calls `/api/admin/orders?limit=100`
- Maps `buyerName` from API response into the Order objects
- Added `adminOrders: []` to logout and deleteAccount reset states

### 4. Component Update: `/src/components/ecommerce/admin-orders-screen.tsx`
- Changed from `orders` (user-specific) to `adminOrders` (all orders with buyer info)
- Added `fetchAdminOrders` to useEffect on component mount
- Changed `buyerName: 'Buyer'` to `buyerName: order.buyerName || 'Buyer'` - uses actual buyer name with fallback

## Lint Status
✅ Passes with no errors
