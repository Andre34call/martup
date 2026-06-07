# Task 7: seller-api-security-fix

## Summary
Fixed 8 P0/P1/P2 security vulnerabilities across 3 API route files.

## Files Modified
1. `src/app/api/products/[id]/route.ts` — Fix 1: Blocked products visibility
2. `src/app/api/seller/products/route.ts` — Fixes 2, 4, 5, 6, 7, 8
3. `src/app/api/setup/storage/route.ts` — Fix 3: Admin-only auth

## Changes Detail

### Fix 1 (P0): Blocked products visible to public
- GET handler now checks `product.status !== 'active'` instead of only `product.status === 'draft'`
- Non-active products require auth + ownership/admin role to view
- Returns 404 (not 403) to avoid leaking product existence

### Fix 2 (P0): Seller can set isFeatured/isFlashSale
- POST: Forces `isFeatured: false`, `isFlashSale: false`, `flashSaleEnd: null`
- PUT: Completely omits these admin-only fields from updateData

### Fix 3 (P0): Storage setup accessible by non-admin
- Changed `verifyAuth` to `verifyAdmin` in both POST and GET handlers

### Fix 4 (P1): No price/stock/weight validation on POST
- Added type + range validation for price (>0), stock (>=0), weight (>=0), minOrder (>=1)

### Fix 5 (P1): discountPrice >= price not prevented
- POST: Validates discountPrice < price before create
- PUT: Validates discountPrice < effectivePrice (provided price or existing product price)

### Fix 6 (P1): Image URL not validated
- Validates URLs are https or from Supabase domain after blob: filtering
- Enforces max 8 images per product using UPLOAD_LIMITS.MAX_PRODUCT_IMAGES

### Fix 7 (P1): Variant fields not sanitized
- Sanitizes variant name/value with sanitizeInput()
- Validates variant stock >= 0
- Fixes v.price || null → v.price !== undefined && v.price !== null ? v.price : null
- Validates variant image URLs (same as product images)

### Fix 8 (P2): Category ID not validated against database
- Checks category exists in DB before creating product

## Verification
- `bun run lint` passes with no errors
- Dev server running correctly
