import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { AdminSlice, AppStore } from './types'
import type { AdminStats, WithdrawStatus, Order } from '../types'
import { apiClient } from '@/lib/api-client'

// Type aliases for API responses
type DivisionsResponse = { success: boolean; divisions: any[] }
type AdminUsersResponse = { success: boolean; data?: any[]; users?: any[] }
type AdminOrdersResponse = { success: boolean; data: Order[] }
type AdminStatsResponse = { success: boolean; data: AdminStats }
type AdminWithdrawalsResponse = { success: boolean; data: any[] }
type AdminBannersResponse = { success: boolean; data: any[] }
type AdminComplaintsResponse = { success: boolean; data: any[] }
type PlatformSettingsResponse = { success: boolean; data: Record<string, number | boolean | string> }

export const createAdminSlice: StateCreator<AppStore, [], [], AdminSlice> = (set, get) => ({
  adminUsers: [],
  updateAdminUser: (userId, updates) => set((state) => ({
    adminUsers: state.adminUsers.map(u => u.id === userId ? { ...u, ...updates } : u)
  })),
  deleteAdminUser: (userId) => set((state) => ({
    adminUsers: state.adminUsers.filter(u => u.id !== userId)
  })),

  adminBanners: [],
  addAdminBanner: (banner) => set((state) => ({
    adminBanners: [...state.adminBanners, banner]
  })),
  updateAdminBanner: (bannerId, updates) => set((state) => ({
    adminBanners: state.adminBanners.map(b => b.id === bannerId ? { ...b, ...updates } : b)
  })),
  deleteAdminBanner: (bannerId) => set((state) => ({
    adminBanners: state.adminBanners.filter(b => b.id !== bannerId)
  })),

  adminComplaints: [],
  updateAdminComplaint: (complaintId, updates) => set((state) => ({
    adminComplaints: state.adminComplaints.map(c => c.id === complaintId ? { ...c, ...updates } : c)
  })),

  divisions: [],
  fetchDivisions: async () => {
    try {
      const data = await apiClient.get<DivisionsResponse>('/api/admin/divisions')
      if (data.success) {
        set({ divisions: data.divisions })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch divisions error')
    }
  },
  fetchAdminUsers: async () => {
    try {
      const data = await apiClient.get<AdminUsersResponse>('/api/admin/users')
      if (data.success) {
        const users = data.data || data.users || []
        set({
          adminUsers: users.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone || '',
            role: u.role,
            isVerified: u.isVerified,
            isBlocked: u.isBlocked,
            joinDate: u.joinDate,
            totalSpent: u.totalSpent || 0,
            totalOrders: u.totalOrders || 0,
            divisionId: u.divisionId || null,
          })),
        })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch admin users error')
    }
  },
  assignUserToDivision: async (userId, divisionId) => {
    try {
      await apiClient.patch('/api/admin/users', { userId, updates: { divisionId } })
      // Refresh divisions to update member counts
      get().fetchDivisions()
      get().fetchAdminUsers()
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Assign user to division error')
    }
  },
  updateDivision: async (divisionId, updates) => {
    try {
      await apiClient.patch('/api/admin/divisions', { divisionId, updates })
      // Refresh divisions
      get().fetchDivisions()
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Update division error')
    }
  },

  adminStats: null,
  adminOrders: [],
  fetchAdminOrders: async () => {
    try {
      const data = await apiClient.get<AdminOrdersResponse>('/api/admin/orders')
      if (data.success && data.data) {
        set({ adminOrders: data.data as Order[] })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch admin orders error')
    }
  },
  fetchAdminStats: async () => {
    try {
      const data = await apiClient.get<AdminStatsResponse>('/api/admin/stats')
      if (data.success && data.data) {
        set({ adminStats: data.data as AdminStats })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch admin stats error')
    }
  },
  fetchAdminWithdrawals: async () => {
    try {
      const data = await apiClient.get<AdminWithdrawalsResponse>('/api/admin/withdrawals')
      if (data.success && data.data) {
        // Map withdrawals to store's WithdrawRequest format
        const withdrawals = data.data.map((w: any) => ({
          id: w.id,
          sellerId: w.sellerId,
          sellerName: w.sellerName || w.storeName || 'Unknown',
          amount: w.amount,
          adminFee: 0,
          netAmount: w.amount,
          bankAccount: {
            id: `ba-wd-${w.id}`,
            bankName: w.bankName || '',
            accountNumber: w.bankAccount || '',
            accountHolder: w.bankHolder || '',
            isDefault: false,
          },
          status: w.status === 'processed' ? 'completed' : (w.status as WithdrawStatus),
          requestDate: w.createdAt ? new Date(w.createdAt).toISOString() : new Date().toISOString(),
          estimatedArrival: '1-2 hari kerja',
          processedDate: w.processedAt ? new Date(w.processedAt).toISOString() : undefined,
          adminNote: w.adminNote,
        }))
        set({ withdrawRequests: withdrawals })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch admin withdrawals error')
    }
  },
  fetchAdminBanners: async () => {
    try {
      const data = await apiClient.get<AdminBannersResponse>('/api/admin/banners')
      if (data.success && data.data) {
        set({
          adminBanners: data.data.map((b: any) => ({
            id: b.id,
            title: b.title,
            image: b.image,
            link: b.link || '',
            position: b.position || 'home_top',
            isActive: b.isActive ?? true,
            sortOrder: b.sortOrder ?? 0,
            startDate: b.startDate || null,
            endDate: b.endDate || null,
          }))
        })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch admin banners error')
    }
  },
  fetchAdminComplaints: async () => {
    try {
      const data = await apiClient.get<AdminComplaintsResponse>('/api/admin/complaints')
      if (data.success && data.data) {
        set({
          adminComplaints: data.data.map((c: any) => ({
            id: c.id,
            userId: c.userId || '',
            userName: c.userName || c.buyer || '',
            type: c.type || 'complaint',
            description: c.description || '',
            status: c.status || 'open',
            createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
            response: c.resolution || c.response,
            orderId: c.orderId || '',
            buyer: c.buyer || '',
            seller: c.seller || '',
          }))
        })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch admin complaints error')
    }
  },

  platformSettings: null,
  fetchPlatformSettings: async () => {
    try {
      const data = await apiClient.get<PlatformSettingsResponse>('/api/admin/settings')
      if (data.success && data.data) {
        set({ platformSettings: data.data as Record<string, number | boolean | string> })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch platform settings error')
    }
  },
})
