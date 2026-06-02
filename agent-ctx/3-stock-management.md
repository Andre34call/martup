# Task 3 - Stock Management: Out-of-Stock Badge, Low Stock, Cart Validation, Stock Audit Trail

## Summary
Implemented all 4 sub-tasks for stock management with zero breaking changes.

## Changes Made

### 1. Out-of-Stock Badge (HIGH) — Updated
- **ProductCard** (`src/components/ecommerce/shared/product.tsx`): Changed "Habis" overlay text to "Stok Habis" in both grid and list layouts
- **ProductDetailScreen** (`src/components/ecommerce/product-detail-screen.tsx`): Already had "Stok Habis" text on the Beli Sekarang button and stock info line — verified as correct

### 2. Low Stock Indicator (MEDIUM) — Already Implemented
- ProductCard already shows "Hanya {stock} tersisa!" in amber + "{stock} tersisa" badge on image
- ProductDetailScreen already shows "Stok: {effectiveStock} (Hampir habis!)" in amber
- No changes needed

### 3. Cart Stock Validation (HIGH) — Enhanced
- **ProductDetailScreen**: Added client-side pre-validation in `handleAddToCart` and `handleBuyNow`:
  - Checks if `currentCartQty + quantity > effectiveStock`
  - Shows toast "Stok tidak mencukupi. Tersedia: X, Di keranjang: Y" if exceeding
  - Prevents adding before server roundtrip (better UX)
- **Cart API** already had server-side stock validation with existing cart quantity check
- **Checkout screen** already had stock validation before order creation
- **Order API** already had double stock validation in transaction (race condition safe)

### 4. Stock Audit Trail (MEDIUM) — Enhanced
- **Prisma Schema** (`prisma/schema.prisma`):
  - Added `variantId` (optional FK to ProductVariant) to StockLog model
  - Added `orderId` (optional FK to Order) to StockLog model
  - Added `stockLogs` relation to ProductVariant model
  - Added `stockLogs` relation to Order model
  - Added indexes on `orderId` and `variantId`
  - Added "return" to StockLog type comment
- **stock-utils.ts**: Updated `LogStockChangeParams` interface and both `logStockChange`/`logStockChangeInTx` functions to accept `variantId` and `orderId`
- **Order creation** (`src/app/api/orders/route.ts`): Updated logStockChangeInTx call to include `variantId` and `orderId`
- **Order cancellation** (`src/lib/order-utils.ts`): Updated logStockChangeInTx call to include `variantId` and `orderId`
- **Direct cancel route** (`src/app/api/orders/[id]/cancel/route.ts`): Added logStockChangeInTx import and stock logging on cancel (was missing)
- **Cron cancel-expired** (`src/app/api/cron/cancel-expired/route.ts`): Added logStockChangeInTx import and stock logging on auto-cancel (was missing)
- **Admin stock-logs API** (`src/app/api/admin/stock-logs/route.ts`): Updated to include variant and order relations in response
- **Admin UI** (`src/components/ecommerce/admin/stock-movements.tsx`): Created AdminStockMovements screen component with:
  - Summary cards (total changes, current page)
  - Search by product name, note, order number, variant value
  - Type filter chips (Semua, Pesanan, Pembatalan, Restock, Penyesuaian, Pengembalian)
  - Color-coded log entries with type icons, quantity change arrows, previous→new display
  - Variant and order number display in log entries
  - Pagination controls
  - Loading skeleton and empty state
- **Admin dashboard** (`src/components/ecommerce/admin/dashboard.tsx`): Added "Stock Log" quick nav item
- **Admin barrel exports**: Added AdminStockMovements to admin/index.ts and admin-new-screens.tsx
- **Page routing** (`src/app/page.tsx`): Added admin-stock-movements screen case and import
- **Types** (`src/lib/types.ts`): Added 'admin-stock-movements' to ScreenName type
- **ADMIN_SCREENS** array: Added 'admin-stock-movements'

## Verification
- `bun run lint` passes ✅
- Dev server compiles and renders ✅
- `bun run db:push` requires Supabase env vars (not available in local sandbox) — schema changes will be pushed on deployment
