# Task 9-c: Update Product Detail, Category, Wishlist, and Seller Shop screens to use API-based backend

## Summary
Verified all 4 target screens already use API hooks (previously updated by earlier agents). Updated shared components (ProductCard, BottomNav) to also use API hooks instead of Zustand stores for consistency.

## Changes Made

### shared.tsx
- **ProductCard**: Replaced `useWishlistStore` with `useWishlist(userId)` + `useToggleWishlist()` API hooks
  - Gets userId from `useAuthStore`
  - Checks wishlist status from API data: `wishlistData?.items?.some(item => item.productId === product.id)`
  - Toggle via `toggleWishlistMutation.mutate({ userId, productId })`
  - Shows login toast if user not authenticated
- **BottomNav**: Replaced `useCartStore` with `useCart(userId)` API hook
  - Cart badge count: `cartData?.items?.length || 0`
  - Consistent with cart screen data source

### search-screen.tsx
- Removed unused `useWishlistStore` import

### home-screen.tsx
- Removed unused `useCartStore` import

## Verified Screens (already using API hooks)
1. **Product Detail Screen**: useProduct, useReviews, useAddToCart, useWishlist, useToggleWishlist, useCreateChatRoom
2. **Category Screen**: useCategories with loading skeleton
3. **Category Detail Screen**: useCategories + useProducts({ category, sort })
4. **Wishlist Screen**: useWishlist(userId) + useToggleWishlist()
5. **Seller Shop Screen**: useProducts({ sellerId, sort }) + useCreateChatRoom()

## Remaining Zustand Dependencies (no API endpoint)
- MOCK_SHIPPING_OPTIONS (no shipping API)
- toggleFollowStore/isFollowingStore (no follow API)

## Lint Status
- Passes cleanly with no errors
