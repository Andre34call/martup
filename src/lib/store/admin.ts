import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { AdminSlice, AppStore, AdminUserItem, AdminBannerItem, AdminComplaintItem } from './types'
import type { AdminStats, WithdrawStatus, Order, Division, WithdrawRequest } from '../types'
import { apiClient } from '@/lib/api-client'
import type {
  AdminDivisionsResponse,
  AdminUsersResponse as AdminUsersApiResponse,
  AdminOrdersResponse as AdminOrdersApiResponse,
  AdminStatsResponse as AdminStatsApiResponse,
  AdminWithdrawalsResponse as AdminWithdrawalsApiResponse,
  AdminBannersResponse as AdminBannersApiResponse,
  AdminComplaintsResponse as AdminComplaintsApiResponse,
  PlatformSettingsResponse as PlatformSettingsApiResponse,
} from '@/lib/api-types'

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
      const data = await apiClient.get<AdminDivisionsResponse>('/api/admin/divisions')
      if (data.success) {
        set({ divisions: data.divisions as unknown as Division[] })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch divisions error')
    }
  },
  fetchAdminUsers: async () => {
    try {
      const data = await apiClient.get<AdminUsersApiResponse>('/api/admin/users')
      if (data.success) {
        const users = data.data || data.users || []
        set({
          adminUsers: users.map((u: Record<string, unknown>): AdminUserItem => ({
            id: u.id as string,
            name: u.name as string,
            email: u.email as string,
            phone: (u.phone as string) || '',
            role: u.role as string,
            isVerified: u.isVerified as boolean,
            isBlocked: u.isBlocked as boolean,
            joinDate: u.joinDate as string,
            totalSpent: (u.totalSpent as number) || 0,
            totalOrders: (u.totalOrders as number) || 0,
            divisionId: (u.divisionId as string) || null,
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
      const data = await apiClient.get<AdminOrdersApiResponse>('/api/admin/orders')
      if (data.success && data.data) {
        set({ adminOrders: data.data as unknown as Order[] })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch admin orders error')
    }
  },
  fetchAdminStats: async () => {
    try {
      const data = await apiClient.get<AdminStatsApiResponse>('/api/admin/stats')
      if (data.success && data.data) {
        set({ adminStats: data.data as unknown as AdminStats })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch admin stats error')
    }
  },
  fetchAdminWithdrawals: async () => {
    try {
      const data = await apiClient.get<AdminWithdrawalsApiResponse>('/api/admin/withdrawals')
      if (data.success && data.data) {
        // Map withdrawals to store's WithdrawRequest format
        const withdrawals: WithdrawRequest[] = data.data.map((w: Record<string, unknown>) => ({
          id: w.id as string,
          sellerId: w.sellerId as string,
          sellerName: (w.sellerName as string) || (w.storeName as string) || 'Unknown',
          amount: w.amount as number,
          adminFee: 0,
          netAmount: w.amount as number,
          bankAccount: {
            id: `ba-wd-${w.id as string}`,
            bankName: (w.bankName as string) || '',
            accountNumber: (w.bankAccount as string) || '',
            accountHolder: (w.bankHolder as string) || '',
            isDefault: false,
          },
          status: (w.status === 'processed' ? 'completed' : w.status) as WithdrawStatus,
          requestDate: w.createdAt ? new Date(w.createdAt as string).toISOString() : new Date().toISOString(),
          estimatedArrival: '1-2 hari kerja',
          processedDate: w.processedAt ? new Date(w.processedAt as string).toISOString() : undefined,
          adminNote: w.adminNote as string | undefined,
        }))
        set({ withdrawRequests: withdrawals })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch admin withdrawals error')
    }
  },
  fetchAdminBanners: async () => {
    try {
      const data = await apiClient.get<AdminBannersApiResponse>('/api/admin/banners')
      if (data.success && data.data) {
        set({
          adminBanners: data.data.map((b: Record<string, unknown>): AdminBannerItem => ({
            id: b.id as string,
            title: b.title as string,
            image: b.image as string,
            link: (b.link as string) || '',
            position: (b.position as string) || 'home_top',
            isActive: (b.isActive as boolean) ?? true,
            sortOrder: (b.sortOrder as number) ?? 0,
            startDate: (b.startDate as string) || null,
            endDate: (b.endDate as string) || null,
          }))
        })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch admin banners error')
    }
  },
  fetchAdminComplaints: async () => {
    try {
      const data = await apiClient.get<AdminComplaintsApiResponse>('/api/admin/complaints')
      if (data.success && data.data) {
        set({
          adminComplaints: data.data.map((c: Record<string, unknown>): AdminComplaintItem => ({
            id: c.id as string,
            userId: (c.userId as string) || '',
            userName: (c.userName as string) || (c.buyer as string) || '',
            type: (c.type as string) || 'complaint',
            description: (c.description as string) || '',
            status: (c.status as string) || 'open',
            createdAt: c.createdAt ? new Date(c.createdAt as string).toISOString() : new Date().toISOString(),
            response: (c.resolution as string) || (c.response as string),
            orderId: (c.orderId as string) || '',
            buyer: (c.buyer as string) || '',
            seller: (c.seller as string) || '',
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
      const data = await apiClient.get<PlatformSettingsApiResponse>('/api/admin/settings')
      if (data.success && data.data) {
        set({ platformSettings: data.data as unknown as Record<string, number | boolean | string> })
      }
    } catch (error) {
      logger.warn({ component: 'admin', err: error }, 'Fetch platform settings error')
    }
  },
})
