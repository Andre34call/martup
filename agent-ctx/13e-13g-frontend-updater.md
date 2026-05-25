# Task 13e-13g: Frontend Updates

## Summary
Updated frontend for seller product edit/delete API, sub-categories, and voucher validation.

## Changes Made

### Files Modified
1. **src/lib/store.ts** - Exported `getAuthHeaders`, updated categories type with children, updated `fetchCategories` with recursive mapping
2. **src/components/ecommerce/seller-screens.tsx** - Delete button calls DELETE API with auth headers
3. **src/components/ecommerce/seller-add-product-screen.tsx** - Edit uses PUT `/api/seller/products` instead of admin API
4. **src/components/ecommerce/category-screen.tsx** - Replaced mock sub-categories with API-driven expandable sub-categories
5. **src/components/ecommerce/checkout-screen.tsx** - Added server-side voucher validation before payment
6. **src/components/ecommerce/missing-screens.tsx** - VoucherScreen fetches from `/api/vouchers` API

## Lint Status
All lint checks pass (0 errors).
