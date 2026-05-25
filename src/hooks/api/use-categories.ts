'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Category } from '@/lib/types'

// ==================== Types ====================

interface CategoriesResponse {
  categories: Category[]
}

// ==================== Query Keys ====================

export const categoryKeys = {
  all: ['categories'] as const,
}

// ==================== Hooks ====================

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: () => apiClient.get<CategoriesResponse>('/api/categories'),
    staleTime: 5 * 60 * 1000, // Categories rarely change, cache for 5 minutes
  })
}
