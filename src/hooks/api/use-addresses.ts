'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Address } from '@/lib/types'

// ==================== Types ====================

interface AddressesResponse {
  addresses: Address[]
}

interface AddAddressData {
  userId: string
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
    queryFn: () => apiClient.get<AddressesResponse>('/api/addresses', { userId: userId || undefined }),
    enabled: !!userId,
  })
}

export function useAddAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AddAddressData) =>
      apiClient.post<{ address: Address }>('/api/addresses', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: addressKeys.detail(variables.userId) })
    },
  })
}

export function useUpdateAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateAddressData) =>
      apiClient.put<{ address: Address }>(`/api/addresses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all })
    },
  })
}

export function useDeleteAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.del<{ success: boolean }>(`/api/addresses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.all })
    },
  })
}
