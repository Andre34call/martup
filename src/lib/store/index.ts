import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppStore } from './types'

// Slice creators
import { createNavigationSlice } from './navigation'
import { createAuthSlice, setCartStoreRef } from './auth'
import { createSelectionSlice } from './selection'
import { createUISlice } from './ui'
import { createNotificationSlice } from './notification'
import { createChatSlice } from './chat'
import { createOrderSlice } from './order'
import { createAddressSlice } from './address'
import { createWalletSlice } from './wallet'
import { createVoucherSlice } from './voucher'
import { createFollowedStoresSlice } from './followed-stores'
import { createSearchSlice } from './search'
import { createProfileSlice } from './profile'
import { createSellerSlice } from './seller'
import { createProductSlice } from './product'
import { createReviewSlice } from './review'
import { createAdminSlice } from './admin'
import { createSettingsSlice } from './settings'
import { createDataFetchSlice, setWishlistStoreRef } from './data-fetch'

// Separate stores
import { useCartStore } from './cart'
import { useWishlistStore } from './wishlist'

// Shared utilities
export { getAuthHeaders } from './getAuthHeaders'
export { useCartStore } from './cart'
export { useWishlistStore } from './wishlist'

// ==================== COMPOSED APP STORE ====================

export const useAppStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createNavigationSlice(...a),
      ...createAuthSlice(...a),
      ...createSelectionSlice(...a),
      ...createUISlice(...a),
      ...createNotificationSlice(...a),
      ...createChatSlice(...a),
      ...createOrderSlice(...a),
      ...createAddressSlice(...a),
      ...createWalletSlice(...a),
      ...createVoucherSlice(...a),
      ...createFollowedStoresSlice(...a),
      ...createSearchSlice(...a),
      ...createProfileSlice(...a),
      ...createSellerSlice(...a),
      ...createProductSlice(...a),
      ...createReviewSlice(...a),
      ...createAdminSlice(...a),
      ...createSettingsSlice(...a),
      ...createDataFetchSlice(...a),
    }),
    {
      name: 'martup-storage',
      version: 2,
      partialize: (state) => ({
        // Only persist non-sensitive UI preferences
        // Do NOT persist currentScreen — it can reference protected screens
        previousScreens: [],
        settings: state.settings,
        searchHistory: state.searchHistory,
        // Do NOT persist: currentScreen, orders, notifications, products, wallet, vouchers, etc.
      }),
    }
  )
)

// Wire up cross-store references (cart store used by logout, wishlist store used by fetchUserData)
setCartStoreRef(useCartStore)
setWishlistStoreRef(useWishlistStore)
