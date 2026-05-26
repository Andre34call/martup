import type { StateCreator } from 'zustand'
import type { NotificationSlice, AppStore } from './types'
import { getAuthHeaders } from './getAuthHeaders'
import { logger } from '@/lib/logger'

export const createNotificationSlice: StateCreator<AppStore, [], [], NotificationSlice> = (set, get) => ({
  notifications: [],
  unreadNotificationCount: 0,
  markNotificationRead: (id) => set((state) => {
    const notification = state.notifications.find(n => n.id === id)
    if (!notification || notification.isRead) return state
    // Also update on server
    fetch('/api/notifications', {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ notificationId: id }),
    }).catch(() => {})
    return {
      notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
      unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1)
    }
  }),
  markAllNotificationsRead: () => set((state) => {
    const userId = get().currentUser?.id
    if (userId) {
      fetch('/api/notifications', {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ markAll: true, userId }),
      }).catch(() => {})
    }
    return {
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadNotificationCount: 0
    }
  }),
  fetchNotifications: async (userId: string) => {
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch notifications')
      const data = await res.json()
      if (data.success && data.data) {
        const notifications = data.data.map((n: any) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          type: n.type || 'system',
          isRead: n.isRead,
          createdAt: n.createdAt,
          actionUrl: n.actionUrl || undefined,
        }))
        const unreadCount = notifications.filter((n: any) => !n.isRead).length
        set({ notifications, unreadNotificationCount: unreadCount })
      }
    } catch (error) {
      logger.warn({ component: 'notification', err: error }, 'Fetch notifications error')
    }
  },
})
