'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Order, OrderStatus } from '@/lib/types'
import { cartKeys } from './use-cart'

// ==================== Types ====================

interface OrdersResponse {
  orders: Order[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface OrderResponse {
  order: Order
}

interface OrderFilters {
  userId?: string
  sellerId?: string
  status?: string
  page?: string
  limit?: string
  /** Set to true to fetch all orders (e.g., for admin) without requiring userId/sellerId */
  _all?: boolean
}

interface CreateOrderData {
  userId: string
  addressId: string
  paymentMethod: string
  shippingProvider?: string
  shippingService?: string
  voucherCode?: string
  items: {
    productId: string
    variantId?: string
    quantity: number
  }[]
}

interface UpdateOrderStatusData {
  id: string
  status: OrderStatus
}

// ==================== Query Keys ====================

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
}

// ==================== Hooks ====================

export function useOrders(filters?: OrderFilters) {
  // Allow fetching all orders (e.g., for admin) when no filter is provided
  const hasFilter = !!(filters?.userId || filters?.sellerId)
  const fetchAll = filters?._all === true
  return useQuery({
    queryKey: orderKeys.list(filters || {}),
    queryFn: () => {
      const { _all, ...params } = (filters || {}) as Record<string, string | undefined> & { _all?: boolean }
      return apiClient.get<OrdersResponse>('/api/orders', params)
    },
    enabled: hasFilter || fetchAll,
  })
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: orderKeys.detail(id || ''),
    queryFn: () => apiClient.get<OrderResponse>(`/api/orders/${id}`),
    enabled: !!id,
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateOrderData) =>
      apiClient.post<{ orders: Order[]; message: string }>('/api/orders', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      queryClient.invalidateQueries({ queryKey: cartKeys.detail(variables.userId) })
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: UpdateOrderStatusData) =>
      apiClient.put<{ order: Order }>(`/api/orders/${id}/status`, { status }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.id) })
    },
  })
}
