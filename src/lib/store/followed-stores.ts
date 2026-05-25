import type { StateCreator } from 'zustand'
import type { FollowedStoresSlice, AppStore } from './types'

export const createFollowedStoresSlice: StateCreator<AppStore, [], [], FollowedStoresSlice> = (set, get) => ({
  followedStoreIds: [],
  toggleFollowStore: (storeId) => set((state) => ({
    followedStoreIds: state.followedStoreIds.includes(storeId)
      ? state.followedStoreIds.filter(id => id !== storeId)
      : [...state.followedStoreIds, storeId]
  })),
  isFollowingStore: (storeId) => get().followedStoreIds.includes(storeId),
})
