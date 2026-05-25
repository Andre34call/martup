# Task 8 - React Query Hooks & API Client

## What was done

Created comprehensive React Query hooks for all 30+ API endpoints and a unified API client for the MartUp e-commerce app.

## Files Created

### API Client
- `/src/lib/api-client.ts` — Unified fetch wrapper with get/post/put/del/upload methods, auth headers, JSON parsing, error handling

### Auth Store
- `/src/store/auth-store.ts` — Zustand store for auth state with localStorage persistence, login/register/logout/fetchMe/switchRole

### React Query Hooks (16 files in /src/hooks/api/)
- `use-products.ts` — useProducts, useProduct, useCreateProduct, useUpdateProduct, useDeleteProduct
- `use-categories.ts` — useCategories
- `use-cart.ts` — useCart, useAddToCart, useUpdateCartItem, useRemoveCartItem
- `use-orders.ts` — useOrders, useOrder, useCreateOrder, useUpdateOrderStatus
- `use-reviews.ts` — useReviews, useCreateReview
- `use-chat.ts` — useChatRooms, useChatMessages, useSendMessage, useCreateChatRoom
- `use-wishlist.ts` — useWishlist, useToggleWishlist
- `use-wallet.ts` — useWallet, useTopUpWallet, useWithdrawWallet
- `use-withdrawals.ts` — useWithdrawals, useUpdateWithdrawal
- `use-notifications.ts` — useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead
- `use-vouchers.ts` — useVouchers, useValidateVoucher
- `use-addresses.ts` — useAddresses, useAddAddress, useUpdateAddress, useDeleteAddress
- `use-seller.ts` — useSellerDashboard
- `use-admin.ts` — useAdminDashboard, useAdminUsers, useApproveProduct, useAdminWithdrawals
- `use-upload.ts` — useUpload, useUploadMultiple
- `provider.tsx` — ApiProvider with QueryClient (30s staleTime, retry: 1)
- `index.ts` — Barrel exports

## Files Modified
- `/src/components/ecommerce/providers.tsx` — Updated to use ApiProvider from new location

## Key Design Decisions
- Query key factories per entity for granular cache invalidation
- Mutations invalidate related queries on success (e.g., create order invalidates orders + cart + wallet)
- Auth store persists to localStorage with `martup_` prefix
- API client reads Bearer token from localStorage automatically
- StaleTime varies by entity type (30s for dashboard, 2m for vouchers, 5m for categories)
