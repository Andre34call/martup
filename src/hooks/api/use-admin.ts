'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { AdminStats, User } from '@/lib/types'

// ==================== Types ====================

interface AdminDashboardResponse {
  stats: AdminStats
}

interface AdminUsersResponse {
  users: (User & { seller?: { id: string; storeName: string; isVerified: boolean; isPremium: boolean } | null })[]
}

interface AdminWithdrawalsResponse {
  withdrawals: {
    id: string
    sellerId: string
    amount: number
    bankName: string
    bankAccount: string
    bankHolder: string
    status: string
    createdAt: string
    seller: {
      id: string
      storeName: string
      storeAvatar?: string
    }
  }[]
}

interface ApproveProductData {
  id: string
  status: 'active' | 'blocked'
}

// ==================== Query Keys ====================

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  withdrawals: () => [...adminKeys.all, 'withdrawals'] as const,
}

// ==================== Hooks ====================

export function useAdminDashboard() {
  return useQuery({
    queryKey: adminKeys.dashboard(),
    queryFn: () => apiClient.get<AdminDashboardResponse>('/api/admin/dashboard'),
    staleTime: 30 * 1000,
  })
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: () => apiClient.get<AdminUsersResponse>('/api/admin/users'),
  })
}

export function useApproveProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: ApproveProductData) =>
      apiClient.put<{ product: { id: string; status: string } }>(`/api/admin/products/${id}/approve`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() })
    },
  })
}

export function useAdminWithdrawals() {
  return useQuery({
    queryKey: adminKeys.withdrawals(),
    queryFn: () => apiClient.get<AdminWithdrawalsResponse>('/api/admin/withdrawals'),
  })
}
