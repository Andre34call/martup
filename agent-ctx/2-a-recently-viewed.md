# Task 2-a: Recently Viewed Products Feature

## Summary
Implemented the "Recently Viewed Products" feature for the MartUp e-commerce app.

## Changes Made

### 1. Store (`src/lib/store.ts`)
- Added `recentlyViewedProductIds: string[]` to AppState interface
- Added `addRecentlyViewed: (productId: string) => void` to AppState interface
- Implemented `addRecentlyViewed`: adds product ID to front, moves existing to front, max 20 items
- Initialized with empty array

### 2. Product Detail Screen (`src/components/ecommerce/product-detail-screen.tsx`)
- Added `useEffect` import
- Added `addRecentlyViewed` to store destructuring
- Added `useEffect` that calls `addRecentlyViewed(product.id)` when `product?.id` changes

### 3. Home Screen (`src/components/ecommerce/home-screen.tsx`)
- Added `formatPrice` import from mock-data
- Added `recentlyViewedProductIds` to store destructuring
- Added "Terakhir Dilihat" section between Category Section and Product Feed
- Section only shows when there are recently viewed products
- Horizontal scrollable cards with product image, name, and price

### 4. Search Screen (`src/components/ecommerce/search-screen.tsx`)
- Added `recentlyViewedProductIds` to store destructuring
- Removed mock `recentProducts` useMemo
- Replaced "Recent Products" section with "Terakhir Dilihat" using actual recently viewed data
- Section conditionally renders based on `recentlyViewedProductIds.length > 0`

## Verification
- ESLint passes cleanly
- Dev server compiles successfully
