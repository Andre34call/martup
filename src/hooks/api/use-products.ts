'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Product } from '@/lib/types'

// ==================== Types ====================

interface ProductsResponse {
  products: Product[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface ProductResponse {
  product: Product
}

interface ProductFilters {
  category?: string
  search?: string
  sort?: string
  page?: string
  limit?: string
  sellerId?: string
  isFlashSale?: string
  isFeatured?: string
}

interface CreateProductData {
  sellerId: string
  categoryId: string
  name: string
  description: string
  price: number
  discountPrice?: number
  images?: string[]
  videoUrl?: string
  stock?: number
  minOrder?: number
  weight?: number
  condition?: string
  isFeatured?: boolean
  isFlashSale?: boolean
  flashSaleEnd?: string
  tags?: string[]
  variants?: {
    name: string
    value: string
    sku?: string
    price?: number
    stock: number
    image?: string
  }[]
}

interface UpdateProductData extends Partial<CreateProductData> {
  id: string
}

// ==================== Query Keys ====================

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
}

// ==================== Hooks ====================

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters || {}),
    queryFn: () => apiClient.get<ProductsResponse>('/api/products', filters as Record<string, string | undefined>),
  })
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: productKeys.detail(id || ''),
    queryFn: () => apiClient.get<ProductResponse>(`/api/products/${id}`),
    enabled: !!id,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProductData) =>
      apiClient.post<ProductResponse>('/api/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateProductData) =>
      apiClient.put<ProductResponse>(`/api/products/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.del<{ success: boolean }>(`/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}
