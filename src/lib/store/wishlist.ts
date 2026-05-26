import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getAuthHeaders } from './getAuthHeaders'

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

        // Call API to persist
        if (isCurrentlyWishlisted) {
          fetch('/api/wishlist', {
            method: 'DELETE',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ productId }),
          }).catch((error) => {
            console.error('Remove from wishlist API error:', error)
            // Revert on error
            set((state) => ({ wishlistIds: [...state.wishlistIds, productId] }))
          })
        } else {
          fetch('/api/wishlist', {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ productId }),
          }).catch((error) => {
            console.error('Add to wishlist API error:', error)
            // Revert on error
            set((state) => ({ wishlistIds: state.wishlistIds.filter((id) => id !== productId) }))
          })
        }
      },
      isWishlisted: (productId) => get().wishlistIds.includes(productId),
      syncWishlistFromServer: async (userId) => {
        try {
          const res = await fetch(`/api/wishlist?userId=${userId}`, { headers: getAuthHeaders() })
          if (!res.ok) throw new Error('Failed to fetch wishlist')
          const data = await res.json()
          if (data.success && data.data) {
            const ids = (data.data as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => {
              const product = item.product as Record<string, unknown> | undefined
              return (item.productId as string) || (product?.id as string) || ''
            }).filter(Boolean)
            set({ wishlistIds: ids })
          }
        } catch (error) {
          console.error('Sync wishlist from server error:', error)
        }
      },
    }),
    {
      name: 'martup-wishlist',
    }
  )
)
