import type { StateCreator } from 'zustand'
import type { VoucherSlice, AppStore } from './types'

export const createVoucherSlice: StateCreator<AppStore, [], [], VoucherSlice> = (set) => ({
  vouchers: [],
  selectedVoucher: null,
  selectVoucher: (voucher) => set({ selectedVoucher: voucher }),
  usedVoucherIds: [],
  useVoucher: (voucherId) => set((state) => ({
    usedVoucherIds: state.usedVoucherIds.includes(voucherId)
      ? state.usedVoucherIds
      : [...state.usedVoucherIds, voucherId],
  })),
})
