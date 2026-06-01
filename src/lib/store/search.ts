import type { StateCreator } from 'zustand'
import type { SearchSlice, AppStore } from './types'

export const createSearchSlice: StateCreator<AppStore, [], [], SearchSlice> = (set) => ({
  searchQuery: '',
  searchHistory: [],
  streamSearchHistory: [],
  setSearchQuery: (q) => set({ searchQuery: q }),
  addSearchHistory: (q) => set((state) => ({
    searchHistory: [q, ...state.searchHistory.filter(s => s !== q)].slice(0, 10)
  })),
  clearSearchHistory: () => set({ searchHistory: [] }),
  addStreamSearchHistory: (q) => set((state) => ({
    streamSearchHistory: [q, ...state.streamSearchHistory.filter(s => s !== q)].slice(0, 10)
  })),
  clearStreamSearchHistory: () => set({ streamSearchHistory: [] }),
})
