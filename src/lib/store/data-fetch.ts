import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { DataFetchSlice, AppStore } from './types'
import type { UserRole } from '../types'
import { ELEVATED_ROLES } from '../types'
import { apiClient } from '@/lib/api-client'
import { mapUser, mapSeller, mapWalletMutation, mapOrder, mapNotification, mapAddress, mapReview, mapBanner } from '../mappers'
import { useWishlistStore } from './wishlist'
import { mapSellerWalletToBalance } from '@/lib/store-helpers'
import type { UserDataResponse, BannersResponse, SellerWithWallet } from '@/lib/api-types'

export const createDataFetchSlice: StateCreator<AppStore, [], [], DataFetchSlice> = (set, get) => ({
  isDataLoaded: false,
  homeBanners: [],

  fetchUserData: async (userId: string) => {
    try {
      const raw = await apiClient.get<UserDataResponse>('/api/user-data', { userId })
      const data = raw.data  // Unwrap { success, data } response

      const state = get()

      // Update user
      if (data.user) {
        const user = mapUser(data.user)
        set({
          currentUser: user,
          userRole: user.role,
          isAuthenticated: true,
          avatarUrl: user.avatar || null,
        })
      }

      // Update seller
      if (data.seller) {
        const seller = mapSeller(data.seller as unknown as Record<string, unknown>)
        set({ seller })

        // Update seller balance from seller wallet
        const sellerWithWallet = data.seller as unknown as SellerWithWallet
        if (sellerWithWallet.wallet) {
          set({
            sellerBalance: mapSellerWalletToBalance(sellerWithWallet.wallet),
          })
        }
      }

      // Update wallet
      if (data.wallet) {
        set({
          walletBalance: Number(data.wallet.balance) || 0,
          walletHoldBalance: Number(data.wallet.holdBalance) || 0,
          walletMutations: (data.wallet.mutations || []).map((m) => mapWalletMutation(m as unknown as Record<string, unknown>)),
        })
      }

      // Update orders
      if (data.orders) {
        set({
          orders: data.orders.map((o: Record<string, unknown>) => mapOrder(o, state.currentUser)),
        })
      }

      // Update notifications
      if (data.notifications) {
        set({
          notifications: data.notifications.map(mapNotification),
          unreadNotificationCount: data.unreadNotificationCount || 0,
        })
      }

      // Update addresses
      if (data.addresses) {
        const addressList = data.addresses.map(mapAddress)
        set({
          addresses: addressList,
          selectedAddressId: addressList.find((a) => a.isDefault)?.id || addressList[0]?.id || null,
        })
      }

      // Update reviews
      if (data.reviews) {
        set({
          reviews: data.reviews.map(mapReview),
        })
      }

      // Update wishlist
      if (data.wishlistProductIds && data.wishlistProductIds.length > 0) {
        const { wishlistIds } = useWishlistStore.getState()
        const mergedIds = [...new Set([...wishlistIds, ...data.wishlistProductIds])]
        useWishlistStore.setState({ wishlistIds: mergedIds })
      }

      // Update followed stores
      if (data.followedStoreIds) {
        set({ followedStoreIds: data.followedStoreIds })
      }

      // Fetch platform settings for admin/manager users
      if (ELEVATED_ROLES.includes(data.user?.role as UserRole)) {
        get().fetchPlatformSettings()
      }

      // Fetch latest notifications from API
      get().fetchNotifications(userId)

      set({ isDataLoaded: true })
    } catch (error) {
      logger.warn({ component: 'data-fetch', err: error }, 'Failed to fetch user data')
    }
  },

  fetchHomeBanners: async () => {
    try {
      const data = await apiClient.get<BannersResponse>('/api/banners', { position: 'home_top' })
      if (data.success && data.data) {
        set({
          homeBanners: data.data.map(mapBanner),
        })
      }
    } catch (error) {
      logger.warn({ component: 'data-fetch', err: error }, 'Failed to fetch home banners')
    }
  },
})
