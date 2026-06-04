# Task 1 - full-stack-developer: Fix Navigation Bugs

## Summary
Fixed 4 navigation bugs in the MartUp e-commerce app.

## Changes Made

### 1. `/home/z/my-project/src/app/page.tsx`
- Added `SUB_SCREENS` array with 14 sub-screens that should hide bottom nav
- Added `isSubScreen` check in `Home` component
- Bottom nav is now hidden when on sub-screens (product-detail, checkout, settings, etc.)

### 2. `/home/z/my-project/src/components/ecommerce/shared.tsx`
- **BottomNav**: Made profile tab's role indicator dot a clickable `<button>` (w-3.5 h-3.5) that toggles the role menu on click with `e.stopPropagation()`
- **AdminBottomNav**: Replaced "Exit" tab with "Switch" tab + full role switcher dropdown (Buyer/Seller/Admin)
- **SellerBottomNav**: Same as Admin — replaced "Exit" with "Switch" + role switcher dropdown

### 3. `/home/z/my-project/src/components/ecommerce/product-detail-screen.tsx`
- Changed `handleBack` to use `goBack()` instead of `navigate('home')`
- Added `goBack` to destructured `useAppStore` import

## Lint Status
- Passed with no errors
