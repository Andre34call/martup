'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Review } from '@/lib/types'

// ==================== Types ====================

interface ReviewsResponse {
  reviews: Review[]
}

interface CreateReviewData {
  userId: string
  productId: string
  rating: number
  content?: string
  images?: string[]
}

// ==================== Query Keys ====================

export const reviewKeys = {
  all: ['reviews'] as const,
  byProduct: (productId: string) => [...reviewKeys.all, 'product', productId] as const,
}

// ==================== Hooks ====================

export function useReviews(productId: string | null) {
  return useQuery({
    queryKey: reviewKeys.byProduct(productId || ''),
    queryFn: () => apiClient.get<ReviewsResponse>('/api/reviews', { productId: productId || undefined }),
    enabled: !!productId,
  })
}

export function useCreateReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateReviewData) =>
      apiClient.post<{ review: Review }>('/api/reviews', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.byProduct(variables.productId) })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
