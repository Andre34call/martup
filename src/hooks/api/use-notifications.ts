'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Notification } from '@/lib/types'

// ==================== Types ====================

interface NotificationsResponse {
  notifications: Notification[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  unreadCount: number
}

// ==================== Query Keys ====================

export const notificationKeys = {
  all: ['notifications'] as const,
  detail: (userId: string) => [...notificationKeys.all, userId] as const,
}

// ==================== Hooks ====================

export function useNotifications(userId: string | null) {
  return useQuery({
    queryKey: notificationKeys.detail(userId || ''),
    queryFn: () => apiClient.get<NotificationsResponse>('/api/notifications', { userId: userId || undefined }),
    enabled: !!userId,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.put<{ success: boolean }>(`/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.put<{ success: boolean }>('/api/notifications/read-all', { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
