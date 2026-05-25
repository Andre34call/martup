import type { StateCreator } from 'zustand'
import type { SelectionSlice, AppStore } from './types'

export const createSelectionSlice: StateCreator<AppStore, [], [], SelectionSlice> = (set) => ({
  selectedProductId: null,
  selectedCategoryId: null,
  selectedOrderId: null,
  selectedChatRoomId: null,
  selectedSellerId: null,
  setSelectedProduct: (id) => set({ selectedProductId: id }),
  setSelectedCategory: (id) => set({ selectedCategoryId: id }),
  setSelectedOrder: (id) => set({ selectedOrderId: id }),
  setSelectedChatRoom: (id) => set({ selectedChatRoomId: id }),
  setSelectedSeller: (id) => set({ selectedSellerId: id }),
})
