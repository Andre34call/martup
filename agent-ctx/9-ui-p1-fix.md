# Task 9 - ui-p1-fix Agent Work Record

## Task
Fix multiple P1 UI bugs in seller product upload screen

## Files Modified
1. `src/components/ecommerce/seller-add-product-screen.tsx` — 7 fixes applied
2. `src/components/ecommerce/seller/seller-products.tsx` — 1 fix applied (delete confirmation)

## Fixes Summary
1. SVG XSS: Replaced `file.type.startsWith("image/")` with explicit `UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES` check
2. maxLength: Added `maxLength={70}` on name Input, `maxLength={2000}` on description textarea
3. Discount price validation: Block submission when discountPrice >= priceNumber
4. Double-submit protection: Added `isSubmitting` state, disabled both buttons during submission
5. Image delete on mobile: Changed from hover-only to always visible on mobile (opacity-50)
6. Delete confirmation: Added `window.confirm()` before product deletion
7. Video size text: Changed hardcoded "30MB" to dynamic `{MAX_VIDEO_SIZE_MB}MB` (50MB)

## Verification
- `bun run lint` passes with no errors
