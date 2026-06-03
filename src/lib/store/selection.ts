import type { StateCreator } from 'zustand'
import type { SelectionSlice, AppStore } from './types'

export const createSelectionSlice: StateCreator<AppStore, [], [], SelectionSlice> = (set) => ({
  selectedProductId: null,
  selectedCategoryId: null,
  selectedOrderId: null,
  selectedChatRoomId: null,
  selectedSellerId: null,
  selectedDepositId: null,
  selectedUserId: null,
  shareToStreamProduct: null,
  setSelectedProduct: (id) => set({ selectedProductId: id }),
  setSelectedCategory: (id) => set({ selectedCategoryId: id }),
  setSelectedOrder: (id) => set({ selectedOrderId: id }),
  setSelectedChatRoom: (id) => set({ selectedChatRoomId: id }),
  setSelectedSeller: (id) => set({ selectedSellerId: id }),
  setSelectedDeposit: (id) => set({ selectedDepositId: id }),
  setSelectedUser: (id) => set({ selectedUserId: id }),
  setShareToStreamProduct: (product) => set({ shareToStreamProduct: product }),
  clearShareToStreamProduct: () => set({ shareToStreamProduct: null }),
})
