import type { StateCreator } from 'zustand'
import type { FollowedStoresSlice, AppStore } from './types'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'

type FollowedStoresApiResponse = {
  success?: boolean
  data?: Array<{
    id: string
    storeName: string
    storeSlug: string
    storeAvatar: string
    isVerified: boolean
    isPremium: boolean
    rating: number
    totalProducts: number
    totalSales: number
    followedAt: string
  }>
  followedStoreIds?: string[]
  [key: string]: unknown
}

type ToggleFollowResponse = {
  success?: boolean
  action?: 'followed' | 'unfollowed'
  sellerId?: string
  [key: string]: unknown
}

export const createFollowedStoresSlice: StateCreator<AppStore, [], [], FollowedStoresSlice> = (set, get) => ({
  followedStoreIds: [],
  followedStoresData: [],

  toggleFollowStore: async (storeId: string) => {
    const userId = get().currentUser?.id
    if (!userId) return

    // Optimistic update
    const isCurrentlyFollowing = get().followedStoreIds.includes(storeId)
    const newIds = isCurrentlyFollowing
      ? get().followedStoreIds.filter(id => id !== storeId)
      : [...get().followedStoreIds, storeId]
    const newStoresData = isCurrentlyFollowing
      ? get().followedStoresData.filter(s => s.id !== storeId)
      : get().followedStoresData

    set({
      followedStoreIds: newIds,
      followedStoresData: newStoresData,
    })

    try {
      const res = await apiClient.post<ToggleFollowResponse>('/api/followed-stores', {
        userId,
        sellerId: storeId,
      })

      // If server returned 'unfollowed', remove from storesData; if 'followed', add
      if (res.action === 'followed') {
        // Refetch to get the complete data
        get().fetchFollowedStores(userId)
      }
    } catch (error) {
      // Revert on error
      logger.warn({ component: 'followed-stores', err: error }, 'Failed to toggle follow store')
      set({
        followedStoreIds: isCurrentlyFollowing
          ? [...get().followedStoreIds, storeId]
          : get().followedStoreIds.filter(id => id !== storeId),
      })
    }
  },

  isFollowingStore: (storeId) => get().followedStoreIds.includes(storeId),

  fetchFollowedStores: async (userId: string) => {
    try {
      const res = await apiClient.get<FollowedStoresApiResponse>('/api/followed-stores', { userId })
      if (res.success) {
        set({
          followedStoreIds: res.followedStoreIds || [],
          followedStoresData: res.data || [],
        })
      }
    } catch (error) {
      logger.warn({ component: 'followed-stores', err: error }, 'Failed to fetch followed stores')
    }
  },
})
