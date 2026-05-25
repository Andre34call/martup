'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Product } from '@/lib/types'

// ==================== Types ====================

interface WishlistResponse {
  items: {
    id: string
    productId: string
    product: Product
    createdAt: string
  }[]
}

interface ToggleWishlistData {
  userId: string
  productId: string
}

// ==================== Query Keys ====================

export const wishlistKeys = {
  all: ['wishlist'] as const,
  detail: (userId: string) => [...wishlistKeys.all, userId] as const,
}

// ==================== Hooks ====================

export function useWishlist(userId: string | null) {
  return useQuery({
    queryKey: wishlistKeys.detail(userId || ''),
    queryFn: () => apiClient.get<WishlistResponse>('/api/wishlist', { userId: userId || undefined }),
    enabled: !!userId,
  })
}

export function useToggleWishlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ToggleWishlistData) =>
      apiClient.post<{ isWishlisted: boolean }>('/api/wishlist', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: wishlistKeys.detail(variables.userId) })
      // Also invalidate products in case the UI shows wishlist state
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
