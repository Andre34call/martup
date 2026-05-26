import type { StateCreator } from 'zustand'
import type { AdminSlice, AppStore } from './types'
import type { AdminStats, WithdrawStatus, Order } from '../types'
import { getAuthHeaders } from './getAuthHeaders'

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
      const res = await fetch('/api/admin/divisions', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch divisions')
      const data = await res.json()
      if (data.success) {
        set({ divisions: data.divisions })
      }
    } catch (error) {
      console.error('Fetch divisions error:', error)
    }
  },
  fetchAdminUsers: async () => {
    try {
      const res = await fetch('/api/admin/users', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch admin users')
      const data = await res.json()
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
      console.error('Fetch admin users error:', error)
    }
  },
  assignUserToDivision: async (userId, divisionId) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ userId, updates: { divisionId } }),
      })
      if (!res.ok) throw new Error('Failed to assign user to division')
      // Refresh divisions to update member counts
      get().fetchDivisions()
      get().fetchAdminUsers()
    } catch (error) {
      console.error('Assign user to division error:', error)
    }
  },
  updateDivision: async (divisionId, updates) => {
    try {
      const res = await fetch('/api/admin/divisions', {
        method: 'PATCH',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ divisionId, updates }),
      })
      if (!res.ok) throw new Error('Failed to update division')
      // Refresh divisions
      get().fetchDivisions()
    } catch (error) {
      console.error('Update division error:', error)
    }
  },

  adminStats: null,
  adminOrders: [],
  fetchAdminOrders: async () => {
    try {
      const res = await fetch('/api/admin/orders', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch admin orders')
      const data = await res.json()
      if (data.success && data.data) {
        set({ adminOrders: data.data as Order[] })
      }
    } catch (error) {
      console.error('Fetch admin orders error:', error)
    }
  },
  fetchAdminStats: async () => {
    try {
      const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch admin stats')
      const data = await res.json()
      if (data.success && data.data) {
        set({ adminStats: data.data as AdminStats })
      }
    } catch (error) {
      console.error('Fetch admin stats error:', error)
    }
  },
  fetchAdminWithdrawals: async () => {
    try {
      const res = await fetch('/api/admin/withdrawals', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch admin withdrawals')
      const data = await res.json()
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
      console.error('Fetch admin withdrawals error:', error)
    }
  },
  fetchAdminBanners: async () => {
    try {
      const res = await fetch('/api/admin/banners', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch admin banners')
      const data = await res.json()
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
      console.error('Fetch admin banners error:', error)
    }
  },
  fetchAdminComplaints: async () => {
    try {
      const res = await fetch('/api/admin/complaints', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch admin complaints')
      const data = await res.json()
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
      console.error('Fetch admin complaints error:', error)
    }
  },
})
