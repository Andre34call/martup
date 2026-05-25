import type { StateCreator } from 'zustand'
import type { AddressSlice, AppStore } from './types'

export const createAddressSlice: StateCreator<AppStore, [], [], AddressSlice> = (set) => ({
  addresses: [],
  selectedAddressId: null,
  addAddress: (address) => set((state) => {
    const addresses = address.isDefault
      ? state.addresses.map(a => ({ ...a, isDefault: false })).concat(address)
      : [...state.addresses, address]
    return { addresses, selectedAddressId: address.isDefault ? address.id : state.selectedAddressId }
  }),
  updateAddress: (address) => set((state) => ({
    addresses: state.addresses.map(a => a.id === address.id ? address : a)
  })),
  deleteAddress: (id) => set((state) => ({
    addresses: state.addresses.filter(a => a.id !== id)
  })),
  setDefaultAddress: (id) => set((state) => ({
    addresses: state.addresses.map(a => ({ ...a, isDefault: a.id === id })),
    selectedAddressId: id
  })),
})
