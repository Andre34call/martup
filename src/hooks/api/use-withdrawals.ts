'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

// ==================== Types ====================

interface Withdrawal {
  id: string
  sellerId: string
  amount: number
  bankName: string
  bankAccount: string
  bankHolder: string
  status: 'pending' | 'approved' | 'rejected' | 'processed'
  createdAt: string
  processedAt?: string
  seller?: {
    id: string
    storeName: string
    storeAvatar?: string
  }
}

interface WithdrawalsResponse {
  withdrawals: Withdrawal[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface WithdrawalFilters {
  sellerId?: string
  status?: string
  page?: string
  limit?: string
}

interface UpdateWithdrawalData {
  id: string
  status: 'approved' | 'rejected' | 'processed'
}

// ==================== Query Keys ====================

export const withdrawalKeys = {
  all: ['withdrawals'] as const,
  lists: () => [...withdrawalKeys.all, 'list'] as const,
  list: (filters: WithdrawalFilters) => [...withdrawalKeys.lists(), filters] as const,
}

// ==================== Hooks ====================

export function useWithdrawals(filters?: WithdrawalFilters) {
  return useQuery({
    queryKey: withdrawalKeys.list(filters || {}),
    queryFn: () => apiClient.get<WithdrawalsResponse>('/api/withdrawals', filters as Record<string, string | undefined>),
  })
}

export function useUpdateWithdrawal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: UpdateWithdrawalData) =>
      apiClient.put<{ withdrawal: Withdrawal }>(`/api/withdrawals/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: withdrawalKeys.all })
    },
  })
}
