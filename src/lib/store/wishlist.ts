import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'

interface WishlistSyncResponse {
  success: boolean
  data?: Array<Record<string, unknown>>
}

interface WishlistState {
  wishlistIds: string[]
  toggleWishlist: (productId: string) => void
  isWishlisted: (productId: string) => boolean
  syncWishlistFromServer: (userId: string) => Promise<void>
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlistIds: [],

      toggleWishlist: (productId) => {
        const isCurrentlyWishlisted = get().wishlistIds.includes(productId)

        // Optimistic local update
        set((state) => ({
          wishlistIds: isCurrentlyWishlisted
            ? state.wishlistIds.filter((id) => id !== productId)
            : [...state.wishlistIds, productId],
        }))

        // Call API to persist — check response success, not just network errors
        if (isCurrentlyWishlisted) {
          apiClient.rawDelete('/api/wishlist', { productId })
            .then((res) => res.json())
            .then((data) => {
              if (!data.success) {
                // API returned error — revert
                set((state) => ({ wishlistIds: [...state.wishlistIds, productId] }))
                logger.warn({ component: 'wishlist', productId, error: data.error }, 'Remove from wishlist API failed')
              }
            })
            .catch((error) => {
              // Network error — revert
              set((state) => ({ wishlistIds: [...state.wishlistIds, productId] }))
              logger.warn({ component: 'wishlist', productId, err: error }, 'Remove from wishlist network error')
            })
        } else {
          apiClient.rawPost('/api/wishlist', { productId })
            .then((res) => res.json())
            .then((data) => {
              if (!data.success) {
                // API returned error — revert
                set((state) => ({ wishlistIds: state.wishlistIds.filter((id) => id !== productId) }))
                logger.warn({ component: 'wishlist', productId, error: data.error }, 'Add to wishlist API failed')
              }
            })
            .catch((error) => {
              // Network error — revert
              set((state) => ({ wishlistIds: state.wishlistIds.filter((id) => id !== productId) }))
              logger.warn({ component: 'wishlist', productId, err: error }, 'Add to wishlist network error')
            })
        }
      },

      isWishlisted: (productId) => get().wishlistIds.includes(productId),

      syncWishlistFromServer: async (userId) => {
        try {
          const data = await apiClient.get<WishlistSyncResponse>('/api/wishlist', { userId })
          if (data.success && data.data) {
            const ids = (data.data as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => {
              const product = item.product as Record<string, unknown> | undefined
              return (item.productId as string) || (product?.id as string) || ''
            }).filter(Boolean)
            set({ wishlistIds: ids })
          }
        } catch (error) {
          logger.warn({ component: 'wishlist', err: error }, 'Sync wishlist from server failed')
        }
      },
    }),
    {
      name: 'martup-wishlist',
    }
  )
)
