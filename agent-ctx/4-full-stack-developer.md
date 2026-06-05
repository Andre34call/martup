# Task 4 - Jasa Badge/Indicator Implementation

## Summary
Added "Jasa" (service) badge/indicator to product cards, product detail screen, and seller product list.

## Changes Made

### 1. ProductCard Component (`src/components/ecommerce/shared/product.tsx`)
- Added 🛠️ Jasa badge (purple background, `bg-purple-500`) to **grid layout** product cards when `product.productType === 'jasa'`
  - Positioned at `top-2 left-2` in the image area
  - When both Jasa badge and discount badge exist, discount badge shifts to `top-8 left-2`
- Added 🛠️ Jasa badge to **list layout** product cards at `top-1 left-1`
- Flash sale badge repositioned to right side in list layout to avoid overlap

### 2. Product Detail Screen (`src/components/ecommerce/product-detail-screen.tsx`)
- **ImageGallery**: Added `productType` prop, shows 🛠️ Jasa badge at `top-3 left-3` when jasa
- **Product name**: Added "🛠️ Layanan Jasa" Badge (purple) next to product name when jasa
- **Detail section**:
  - Weight hidden for jasa products
  - Shows `serviceDuration` (e.g., "Durasi: 1 jam") if available
  - Shows `serviceLocation` (e.g., "Lokasi: Online") if available
- **Escrow notice**: Purple info box with Shield icon showing "Pesanan jasa tidak memerlukan pengiriman fisik. Pembayaran ditahan (escrow) sampai jasa selesai."
- **Shipping info section**: Hidden entirely for jasa products (no physical shipping needed)

### 3. Seller Product List (`src/components/ecommerce/seller/seller-products.tsx`)
- Added productType badge next to each product name:
  - "Jasa" badge with purple background for jasa products
  - "Barang" badge with outline style for regular products
- Allows sellers to quickly distinguish between product types

## Design Decisions
- Purple color scheme used consistently for all Jasa badges (matching the add product form)
- Used existing shadcn/ui Badge component
- Badge positioned to not overlap with other badges (flash sale, discount)
- Shipping section hidden rather than just badge-replaced for jasa products (cleaner UX)
- Prisma schema NOT changed (as instructed)

## Lint Result
0 errors — clean compilation
