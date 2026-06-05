# Task 6 - Service Proof UI for Sellers and Buyers

## Summary
Added complete service proof UI for jasa (service) orders in both seller and buyer order screens.

## Changes Made

### 1. Mapper Update (`src/lib/mappers.ts`)
- Added `isServiceOrder`, `serviceProofImages`, `autoConfirmAt` to `RawOrder` type
- Mapped these fields in `mapOrder()` with proper type conversion (JSON string → array, date normalization)

### 2. Seller Orders (`src/components/ecommerce/seller/seller-orders.tsx`)
- "Jasa" badge on service order cards
- "Upload Bukti Jasa" button for processing service orders (instead of "Kirim")
- Service Proof Upload Dialog (URL input + file upload, 1-5 images)
- Service Proof Status View (for shipped service orders - shows proof + countdown)
- `useCountdown` hook for auto-confirm countdown

### 3. Buyer Orders (`src/components/ecommerce/order-screen.tsx`)
- "Jasa" badge on service order cards
- "Konfirmasi" button for shipped service orders (instead of "Lacak")
- Service proof banner with thumbnails + countdown in order card
- Service proof detail section in OrderDetail with full images
- "Konfirmasi Jasa Selesai" button (purple) for shipped service orders
- Service-specific timeline labels and purple color scheme
- Hides shipping address for service orders

### API Calls Used
- POST `/api/orders/[id]/service-proof` — seller uploads proof
- GET `/api/orders/[id]/service-proof` — both parties view proof
- PUT `/api/orders/[id]` with `{ status: 'delivered' }` — buyer confirms

### Lint Status
0 errors, 0 warnings
