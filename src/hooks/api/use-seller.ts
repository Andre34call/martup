'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { SellerStats } from '@/lib/types'

// ==================== Types ====================

interface SellerDashboardResponse {
  stats: SellerStats
}

// ==================== Query Keys ====================

export const sellerKeys = {
  all: ['seller'] as const,
  dashboard: (sellerId: string) => [...sellerKeys.all, 'dashboard', sellerId] as const,
}

// ==================== Hooks ====================

export function useSellerDashboard(sellerId: string | null) {
  return useQuery({
    queryKey: sellerKeys.dashboard(sellerId || ''),
    queryFn: () => apiClient.get<SellerDashboardResponse>('/api/seller/dashboard', { sellerId: sellerId || undefined }),
    enabled: !!sellerId,
    staleTime: 30 * 1000, // Dashboard data refreshes every 30 seconds
  })
}
