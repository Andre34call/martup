import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { DataFetchSlice, AppStore } from './types'
import type { UserRole } from '../types'
import { ELEVATED_ROLES } from '../types'
import { apiClient } from '@/lib/api-client'
import { mapUser, mapSeller, mapWalletMutation, mapOrder, mapNotification, mapAddress, mapReview, mapBanner } from '../mappers'
import { useWishlistStore } from './wishlist'

// API response types
type UserDataApiResponse = { data?: any; [key: string]: any }
type BannersApiResponse = { success?: boolean; data?: any[]; [key: string]: any }

export const createDataFetchSlice: StateCreator<AppStore, [], [], DataFetchSlice> = (set, get) => ({
  isDataLoaded: false,
  homeBanners: [],

  fetchUserData: async (userId: string) => {
    try {
      const raw = await apiClient.get<UserDataApiResponse>('/api/user-data', { userId })
      const data = raw.data || raw  // Unwrap { success, data } response

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
        const seller = mapSeller(data.seller)
        set({ seller })

        // Unified wallet: derive seller balance from the user's single wallet
        // (the wallet is fetched separately, so we'll update sellerBalance from there)
      }

      // Update wallet (unified — single wallet per user)
      if (data.wallet) {
        const walletBalance = Number(data.wallet.balance) || 0
        const walletHoldBalance = Number(data.wallet.holdBalance) || 0
        const walletPendingBalance = Number(data.wallet.pendingBalance) || 0
        set({
          walletBalance,
          walletHoldBalance,
          walletMutations: (data.wallet.mutations || []).map(mapWalletMutation),
          // Derive seller balance from the unified wallet
          sellerBalance: {
            availableBalance: walletBalance,
            pendingBalance: walletPendingBalance,
            holdBalance: walletHoldBalance,
            totalBalance: walletBalance + walletPendingBalance + walletHoldBalance,
            totalWithdrawn: state.sellerBalance.totalWithdrawn,
          },
        })
      }

      // Update orders
      if (data.orders) {
        set({
          orders: data.orders.map((o: any) => mapOrder(o, state.currentUser)),
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
        set({
          addresses: data.addresses.map(mapAddress),
          selectedAddressId: data.addresses.find((a: any) => a.isDefault)?.id || data.addresses[0]?.id || null,
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
      const data = await apiClient.get<BannersApiResponse>('/api/banners', { position: 'home_top' })
      if (data.success && data.data) {
        set({
          homeBanners: data.data.map(mapBanner)
        })
      }
    } catch (error) {
      logger.warn({ component: 'data-fetch', err: error }, 'Failed to fetch home banners')
    }
  },
})
