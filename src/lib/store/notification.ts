import type { StateCreator } from 'zustand'
import type { NotificationSlice, AppStore } from './types'
import type { Notification as AppNotification } from '../types'
import type { NotificationsResponse } from '../api-types'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'

export const createNotificationSlice: StateCreator<AppStore, [], [], NotificationSlice> = (set, get) => ({
  notifications: [],
  unreadNotificationCount: 0,
  markNotificationRead: (id) => set((state) => {
    const notification = state.notifications.find(n => n.id === id)
    if (!notification || notification.isRead) return state
    // Also update on server
    apiClient.rawPut('/api/notifications', { notificationId: id }).catch(() => {})
    return {
      notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
      unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1)
    }
  }),
  markAllNotificationsRead: () => set((state) => {
    const userId = get().currentUser?.id
    if (userId) {
      apiClient.rawPut('/api/notifications', { markAll: true, userId }).catch(() => {})
    }
    return {
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadNotificationCount: 0
    }
  }),
  fetchNotifications: async (userId: string) => {
    try {
      const data = await apiClient.get<NotificationsResponse>('/api/notifications', { userId })
      if (data.success && data.data) {
        const notifications: AppNotification[] = data.data.map((n: Record<string, unknown>) => ({
          id: n.id as string,
          title: n.title as string,
          content: n.content as string,
          type: (n.type as AppNotification['type']) || 'system',
          isRead: n.isRead as boolean,
          createdAt: n.createdAt as string,
        }))
        const unreadCount = notifications.filter(n => !n.isRead).length
        set({ notifications, unreadNotificationCount: unreadCount })
      }
    } catch (error) {
      logger.warn({ component: 'notification', err: error }, 'Fetch notifications error')
    }
  },
})
