'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Voucher } from '@/lib/types'

// ==================== Types ====================

interface VouchersResponse {
  vouchers: Voucher[]
}

interface ValidateVoucherData {
  code: string
  userId: string
  amount: number
  sellerId?: string
}

interface ValidateVoucherResponse {
  valid: boolean
  voucher?: Voucher
  discount: number
  finalAmount: number
  message?: string
}

// ==================== Query Keys ====================

export const voucherKeys = {
  all: ['vouchers'] as const,
  list: (sellerId?: string) => [...voucherKeys.all, sellerId || 'platform'] as const,
}

// ==================== Hooks ====================

export function useVouchers(sellerId?: string) {
  return useQuery({
    queryKey: voucherKeys.list(sellerId),
    queryFn: () => apiClient.get<VouchersResponse>('/api/vouchers', { sellerId }),
    staleTime: 2 * 60 * 1000, // Vouchers don't change often
  })
}

export function useValidateVoucher() {
  return useMutation({
    mutationFn: (data: ValidateVoucherData) =>
      apiClient.post<ValidateVoucherResponse>('/api/vouchers/validate', data),
  })
}
