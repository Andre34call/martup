import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { AddressSlice, AppStore } from './types'
import type { Address } from '../types'
import { apiClient } from '@/lib/api-client'

interface AddressMutationResponse {
  data?: Address
  error?: string
}

interface AddressesResponse {
  success?: boolean
  data?: Address[]
  error?: string
}

export const createAddressSlice: StateCreator<AppStore, [], [], AddressSlice> = (set, get) => ({
  addresses: [],
  selectedAddressId: null,
  addAddress: async (address) => {
    try {
      const res = await apiClient.rawPost('/api/addresses', {
        label: address.label,
        recipient: address.recipient,
        phone: address.phone,
        address: address.address,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
        isDefault: address.isDefault,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const message = err.error || `Gagal menambah alamat (HTTP ${res.status})`
        throw new Error(message)
      }
      const data: AddressMutationResponse = await res.json()
      const serverAddress: Address = data.data!
      set((state) => {
        const addresses = serverAddress.isDefault
          ? state.addresses.map(a => ({ ...a, isDefault: false })).concat(serverAddress)
          : [...state.addresses, serverAddress]
        return {
          addresses,
          selectedAddressId: serverAddress.isDefault ? serverAddress.id : state.selectedAddressId,
        }
      })
    } catch (error) {
      logger.warn({ component: 'address', err: error }, 'addAddress error')
      throw error
    }
  },
  updateAddress: async (address) => {
    try {
      const res = await apiClient.rawPut('/api/addresses', {
        addressId: address.id,
        label: address.label,
        recipient: address.recipient,
        phone: address.phone,
        address: address.address,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
        isDefault: address.isDefault,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const message = err.error || `Gagal memperbarui alamat (HTTP ${res.status})`
        throw new Error(message)
      }
      const data: AddressMutationResponse = await res.json()
      const serverAddress: Address = data.data!
      set((state) => {
        const updatedAddresses = state.addresses.map(a => a.id === serverAddress.id ? serverAddress : a)
        // If the updated address is now default, unset default on others
        const addresses = serverAddress.isDefault
          ? updatedAddresses.map(a => a.id === serverAddress.id ? a : { ...a, isDefault: false })
          : updatedAddresses
        return {
          addresses,
          selectedAddressId: serverAddress.isDefault ? serverAddress.id : state.selectedAddressId,
        }
      })
    } catch (error) {
      logger.warn({ component: 'address', err: error }, 'updateAddress error')
      throw error
    }
  },
  deleteAddress: async (id) => {
    try {
      const res = await apiClient.rawDelete('/api/addresses', { addressId: id })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const message = err.error || `Gagal menghapus alamat (HTTP ${res.status})`
        throw new Error(message)
      }
      set((state) => {
        const filtered = state.addresses.filter(a => a.id !== id)
        const wasDefault = state.addresses.find(a => a.id === id)?.isDefault
        // If deleted address was default, set first remaining as default
        let addresses = filtered
        if (wasDefault && filtered.length > 0) {
          addresses = filtered.map((a, i) => ({ ...a, isDefault: i === 0 }))
        }
        return {
          addresses,
          selectedAddressId: state.selectedAddressId === id
            ? (addresses.find(a => a.isDefault)?.id ?? null)
            : state.selectedAddressId,
        }
      })
    } catch (error) {
      logger.warn({ component: 'address', err: error }, 'deleteAddress error')
      throw error
    }
  },
  setDefaultAddress: async (id) => {
    try {
      const res = await apiClient.rawPut('/api/addresses', { addressId: id, isDefault: true })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const message = err.error || `Gagal mengubah alamat utama (HTTP ${res.status})`
        throw new Error(message)
      }
      set((state) => ({
        addresses: state.addresses.map(a => ({ ...a, isDefault: a.id === id })),
        selectedAddressId: id,
      }))
    } catch (error) {
      logger.warn({ component: 'address', err: error }, 'setDefaultAddress error')
      throw error
    }
  },
  fetchAddresses: async (userId) => {
    try {
      const data = await apiClient.get<AddressesResponse>('/api/addresses', { userId })
      const serverAddresses: Address[] = data.data || []
      const defaultAddr = serverAddresses.find(a => a.isDefault)
      set({
        addresses: serverAddresses,
        selectedAddressId: defaultAddr?.id ?? get().selectedAddressId,
      })
    } catch (error) {
      logger.warn({ component: 'address', err: error }, 'fetchAddresses error')
      throw error
    }
  },
})
