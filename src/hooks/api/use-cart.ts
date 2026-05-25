'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { CartItem } from '@/lib/types'

// ==================== Types ====================

interface CartResponse {
  items: CartItem[]
}

interface AddToCartData {
  userId: string
  productId: string
  variantId?: string
  quantity?: number
}

interface UpdateCartItemData {
  id: string
  quantity?: number
  isChecked?: boolean
}

// ==================== Query Keys ====================

export const cartKeys = {
  all: ['cart'] as const,
  detail: (userId: string) => [...cartKeys.all, userId] as const,
}

// ==================== Hooks ====================

export function useCart(userId: string | null) {
  return useQuery({
    queryKey: cartKeys.detail(userId || ''),
    queryFn: () => apiClient.get<CartResponse>('/api/cart', { userId: userId || undefined }),
    enabled: !!userId,
  })
}

export function useAddToCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AddToCartData) =>
      apiClient.post<{ item: CartItem }>('/api/cart', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: cartKeys.detail(variables.userId) })
    },
  })
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCartItemData) =>
      apiClient.put<{ item: CartItem }>(`/api/cart/${id}`, data),
    onSuccess: () => {
      // Invalidate all cart queries since we may not know the userId here
      queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.del<{ success: boolean }>(`/api/cart/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })
}
