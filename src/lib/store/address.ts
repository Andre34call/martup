import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { AddressSlice, AppStore } from './types'
import type { Address } from '../types'
import { getAuthHeaders } from './getAuthHeaders'
import { ensureCsrfToken, fetchFreshCsrfToken } from '@/lib/csrf-client'

/**
 * Fetch with CSRF retry — ensures a CSRF token is available before making
 * the request, and retries with a fresh token if CSRF validation fails.
 */
async function fetchWithCsrfRetry(url: string, options: RequestInit): Promise<Response> {
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
    (options.method || 'GET').toUpperCase()
  )

  // For mutating requests, ensure we have a CSRF token before making the request
  if (isMutating) {
    const csrfToken = await ensureCsrfToken()
    if (csrfToken) {
      const existingHeaders = options.headers as Record<string, string> || {}
      options = {
        ...options,
        headers: {
          ...existingHeaders,
          'x-csrf-token': csrfToken,
        },
      }
    }
  }

  const response = await fetch(url, options)

  // If CSRF validation failed, the server returns 403 with a fresh CSRF cookie
  if (response.status === 403 && isMutating) {
    const data = await response.clone().json().catch(() => null)
    if (data?.error?.includes('CSRF') || data?.error?.includes('csrf')) {
      // Fetch a fresh CSRF token from the dedicated endpoint
      const freshToken = await fetchFreshCsrfToken()
      if (freshToken) {
        const existingHeaders = options.headers as Record<string, string> || {}
        const newHeaders = {
          ...existingHeaders,
          'x-csrf-token': freshToken,
        }
        return fetch(url, { ...options, headers: newHeaders })
      }
    }
  }

  return response
}

export const createAddressSlice: StateCreator<AppStore, [], [], AddressSlice> = (set, get) => ({
  addresses: [],
  selectedAddressId: null,
  addAddress: async (address) => {
    try {
      const res = await fetchWithCsrfRetry('/api/addresses', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          label: address.label,
          recipient: address.recipient,
          phone: address.phone,
          address: address.address,
          city: address.city,
          province: address.province,
          postalCode: address.postalCode,
          isDefault: address.isDefault,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const message = err.error || `Gagal menambah alamat (HTTP ${res.status})`
        throw new Error(message)
      }
      const data = await res.json()
      const serverAddress: Address = data.data
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
      const res = await fetchWithCsrfRetry('/api/addresses', {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          addressId: address.id,
          label: address.label,
          recipient: address.recipient,
          phone: address.phone,
          address: address.address,
          city: address.city,
          province: address.province,
          postalCode: address.postalCode,
          isDefault: address.isDefault,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const message = err.error || `Gagal memperbarui alamat (HTTP ${res.status})`
        throw new Error(message)
      }
      const data = await res.json()
      const serverAddress: Address = data.data
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
      const res = await fetchWithCsrfRetry('/api/addresses', {
        method: 'DELETE',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ addressId: id }),
      })
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
      const res = await fetchWithCsrfRetry('/api/addresses', {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ addressId: id, isDefault: true }),
      })
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
      const res = await fetch(`/api/addresses?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const message = err.error || `Gagal memuat alamat (HTTP ${res.status})`
        throw new Error(message)
      }
      const data = await res.json()
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
