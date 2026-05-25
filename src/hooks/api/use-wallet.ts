'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Wallet, WalletMutation as WalletMutationType } from '@/lib/types'

// ==================== Types ====================

interface WalletResponse {
  wallet: Wallet
  mutations: WalletMutationType[]
}

interface TopUpData {
  userId: string
  amount: number
  paymentMethod?: string
}

interface WithdrawData {
  userId: string
  amount: number
  bankName: string
  bankAccount: string
  bankHolder: string
}

// ==================== Query Keys ====================

export const walletKeys = {
  all: ['wallet'] as const,
  detail: (userId: string) => [...walletKeys.all, userId] as const,
}

// ==================== Hooks ====================

export function useWallet(userId: string | null) {
  return useQuery({
    queryKey: walletKeys.detail(userId || ''),
    queryFn: () => apiClient.get<WalletResponse>('/api/wallet', { userId: userId || undefined }),
    enabled: !!userId,
  })
}

export function useTopUpWallet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TopUpData) =>
      apiClient.post<{ wallet: Wallet; mutation: WalletMutationType }>('/api/wallet/topup', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: walletKeys.detail(variables.userId) })
    },
  })
}

export function useWithdrawWallet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: WithdrawData) =>
      apiClient.post<{ wallet: Wallet; withdrawal: { id: string } }>('/api/wallet/withdraw', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: walletKeys.detail(variables.userId) })
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] })
    },
  })
}
