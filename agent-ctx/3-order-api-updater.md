# Task 3: Update Order Creation API for Service Orders

## Summary
Updated POST /api/orders route and createOrderSchema to support service orders (jasa products).

## Changes Made

### 1. `/src/lib/validations.ts`
- Made `addressId` optional in `createOrderSchema` (`.optional()`) so service orders don't require an address

### 2. `/src/app/api/orders/route.ts` — POST handler

**Service order detection** (before transaction):
- Fetches all products by ID and checks `productType === 'jasa'`
- Sets `isServiceOrder = true` only if ALL items are jasa products

**Anti-fraud check** (service orders only):
- Counts active (non-cancelled) service orders between the buyer and seller
- Rejects with 400 if >= 5: "Terlalu banyak pesanan jasa aktif dengan toko ini..."

**Conditional address verification**:
- Service orders: no addressId required, skip address ownership check
- Physical orders: addressId required, verify address exists and belongs to user

**Stock validation** (pre-transaction and in-transaction):
- Skips stock check for jasa products (they have unlimited stock at 999)
- Skips variant stock check for jasa products

**Platform fee**:
- Service orders: 8% (higher rate for increased risk/dispute costs)
- Physical orders: 3% (unchanged)

**Order creation**:
- Sets `isServiceOrder` flag on the order record
- Sets `addressId: null` for service orders
- Sets `shippingCost: 0` for service orders

**Shipping record**:
- Skipped entirely for service orders (`!isServiceOrder` condition added)

**Stock decrement**:
- Jasa products: only increment `sold` count, don't decrement `stock`
- Physical products: increment `sold` + decrement `stock` (unchanged behavior)
- Variant stock decrement also skipped for jasa products

### 3. GET handler — No changes needed
- New scalar fields (`isServiceOrder`, `serviceProofImages`, `autoConfirmAt`, etc.) are automatically returned by Prisma

## Verification
- Lint passes ✅
- Dev server compiles ✅
- All existing security checks for physical orders preserved
