# Task 3: Add products to global Zustand store & sync seller products screen

## Summary
Added `products` array to the global Zustand store and synchronized all screens that were using `MOCK_PRODUCTS` directly to use the store instead. This ensures that when a seller adds/deletes/edits a product, the changes are reflected everywhere in the app.

## Changes Made

### 1. `/home/z/my-project/src/lib/store.ts`
- Added `import { MOCK_PRODUCTS } from './mock-data'`
- Added `products: Product[]` to `AppState` interface
- Added `addProduct`, `updateProduct`, `removeProduct` actions to `AppState` interface
- Initialized `products: MOCK_PRODUCTS` in the store
- Implemented `addProduct` (prepends to array), `updateProduct` (replaces by id), `removeProduct` (filters by id)

### 2. `/home/z/my-project/src/components/ecommerce/seller-screens.tsx`
- Removed `MOCK_PRODUCTS` import (only uses `MOCK_SELLER_STATS` and `formatPrice` from mock-data)
- Removed `mockSellerProducts` local constant
- Replaced `useState(mockSellerProducts)` with `products` from `useAppStore`
- Filter products by `sellerId === "s1"` for the current seller
- Delete button calls `removeProduct(product.id)` from store instead of local state update
- Edit button calls `setSelectedProduct(product.id)` before navigating, enabling edit mode

### 3. `/home/z/my-project/src/components/ecommerce/home-screen.tsx`
- Removed `MOCK_PRODUCTS` import
- Added `products` to `useAppStore` destructuring
- Replaced all `MOCK_PRODUCTS` references with `products` from store
- Added `products` to the IntersectionObserver useEffect dependency

### 4. `/home/z/my-project/src/components/ecommerce/search-screen.tsx`
- Removed `MOCK_PRODUCTS` import
- Added `products` to `useAppStore` destructuring
- Replaced `MOCK_PRODUCTS` with `products` in searchResults useMemo
- Added `products` to useMemo dependency array
- Replaced `MOCK_PRODUCTS.slice(0, 6)` with `products.slice(0, 6)` for recentProducts

### 5. `/home/z/my-project/src/components/ecommerce/product-detail-screen.tsx`
- Removed `MOCK_PRODUCTS` import
- Added `products` to `useAppStore` destructuring
- Replaced `MOCK_PRODUCTS.find()` with `products.find()` for product lookup
- Replaced `MOCK_PRODUCTS.filter()` with `products.filter()` for related products

### 6. `/home/z/my-project/src/components/ecommerce/seller-add-product-screen.tsx`
- Added `addProduct`, `selectedProductId`, `products` to `useAppStore` destructuring
- Added `Product` type import from `@/lib/types`
- Added edit mode: pre-fills form from `editingProduct` when `selectedProductId` is set
- Pre-fills: name, category, description, price, discountPrice, stock, minOrder, weight, condition, variants, tags
- Updated `handleSubmit` to create a full `Product` object and call `addProduct(newProduct)`
- Updated page header title to "Edit Produk" when editing, "Tambah Produk" when adding
- Images validation accounts for existing product images when editing

## Data Flow
1. **Store is the single source of truth**: `products` array lives in Zustand store, initialized from `MOCK_PRODUCTS`
2. **Add product**: `SellerAddProductScreen` → `addProduct()` → store updates → all screens reflect new product
3. **Delete product**: `SellerProducts` → `removeProduct(id)` → store updates → product removed everywhere
4. **Edit product**: `SellerProducts` sets `selectedProductId` → navigates to add-product screen → form pre-fills → submit creates updated product via `addProduct`
5. **View products**: Home, Search, Product Detail all read from `products` in store

## Lint Status
All modified files pass ESLint. The only pre-existing error is in `providers.tsx` (unrelated to this task).
