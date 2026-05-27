'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Address } from '@/lib/types'

// ==================== Types ====================
// Backend returns: { success: boolean, data: Address | Address[] }

interface AddressesResponse {
  success: boolean
  data: Address[]
}

interface AddressResponse {
  success: boolean
  data: Address
}

interface AddAddressData {
  label: string
  recipient: string
  phone: string
  address: string
  city: string
  province: string
  postalCode: string
  isDefault?: boolean
}

interface UpdateAddressData extends Partial<AddAddressData> {
  id: string
}

// ==================== Query Keys ====================

export const addressKeys = {
  all: ['addresses'] as const,
  detail: (userId: string) => [...addressKeys.all, userId] as const,
}

// ==================== Hooks ====================

export function useAddresses(userId: string | null) {
  return useQuery({
    queryKey: addressKeys.detail(userId || ''),
    queryFn: async () => {
      const res = await apiClient.get<AddressesResponse>('/api/addresses', { userId: userId || undefined })
      return res.data
    },
    enabled: !!userId,
  })
}

export function useAddAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: AddAddressData) => {
      const res = await apiClient.post<AddressResponse>('/api/addresses', data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all })
    },
  })
}

export function useUpdateAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateAddressData) => {
      const res = await apiClient.put<AddressResponse>(`/api/addresses/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all })
    },
  })
}

export function useDeleteAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.del<{ success: boolean }>(`/api/addresses/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all })
    },
  })
}
