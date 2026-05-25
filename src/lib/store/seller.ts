import type { StateCreator } from 'zustand'
import type { SellerSlice, AppStore } from './types'
import type { WithdrawRequest, WithdrawStatus, SellerStats } from '../types'

export const createSellerSlice: StateCreator<AppStore, [], [], SellerSlice> = (set, get) => ({
  sellerBalance: {
    availableBalance: 0,
    pendingBalance: 0,
    holdBalance: 0,
    totalBalance: 0,
    totalWithdrawn: 0,
  },
  sellerBankAccounts: [],
  withdrawRequests: [],
  addBankAccount: (account) => set((state) => {
    const accounts = account.isDefault
      ? state.sellerBankAccounts.map(a => ({ ...a, isDefault: false })).concat(account)
      : [...state.sellerBankAccounts, account]
    return { sellerBankAccounts: accounts }
  }),
  removeBankAccount: (id) => set((state) => ({
    sellerBankAccounts: state.sellerBankAccounts.filter(a => a.id !== id)
  })),
  setDefaultBankAccount: (id) => set((state) => ({
    sellerBankAccounts: state.sellerBankAccounts.map(a => ({ ...a, isDefault: a.id === id }))
  })),
  requestWithdraw: (amount, bankAccountId) => set((state) => {
    const bankAccount = state.sellerBankAccounts.find(a => a.id === bankAccountId)
    if (!bankAccount) return state
    if (amount > state.sellerBalance.availableBalance) return state
    const adminFee = 1000
    const netAmount = amount - adminFee
    const sellerName = state.currentUser?.name || 'Unknown Seller'
    const sellerId = state.seller?.id || ''
    const newRequest: WithdrawRequest = {
      id: `wd${Date.now()}`,
      sellerId,
      sellerName,
      amount,
      adminFee,
      netAmount,
      bankAccount,
      status: 'pending',
      requestDate: new Date().toISOString(),
      estimatedArrival: '1-2 hari kerja',
    }
    const newAvailable = state.sellerBalance.availableBalance - amount
    const newHold = state.sellerBalance.holdBalance + amount
    return {
      withdrawRequests: [newRequest, ...state.withdrawRequests],
      sellerBalance: {
        ...state.sellerBalance,
        availableBalance: newAvailable,
        holdBalance: newHold,
        totalBalance: newAvailable + state.sellerBalance.pendingBalance + newHold,
      }
    }
  }),
  updateWithdrawStatus: (id, status, rejectionReason) => set((state) => {
    const wd = state.withdrawRequests.find(w => w.id === id)
    if (!wd) return state
    const now = new Date().toISOString()
    const updatedRequests = state.withdrawRequests.map(w => {
      if (w.id !== id) return w
      return {
        ...w,
        status,
        processedDate: status === 'approved' || status === 'rejected' ? now : w.processedDate,
        completedDate: status === 'completed' ? now : w.completedDate,
        rejectionReason: rejectionReason || w.rejectionReason,
      }
    })
    let newBalance = { ...state.sellerBalance }
    if (status === 'approved') {
      newBalance.holdBalance = Math.max(0, newBalance.holdBalance - wd.amount)
    }
    if (status === 'rejected') {
      newBalance.availableBalance += wd.amount
      newBalance.holdBalance = Math.max(0, newBalance.holdBalance - wd.amount)
    }
    if (status === 'completed') {
      newBalance.totalWithdrawn += wd.amount
      newBalance.lastWithdrawDate = now
    }
    newBalance.totalBalance = newBalance.availableBalance + newBalance.pendingBalance + newBalance.holdBalance
    return {
      withdrawRequests: updatedRequests,
      sellerBalance: newBalance,
    }
  }),
  getSellerAvailableForWithdraw: () => get().sellerBalance.availableBalance,
  seller: null,
  sellerStats: null,
  fetchSellerStats: async () => {
    const sellerId = get().seller?.id
    if (!sellerId) return
    try {
      const res = await fetch(`/api/seller/stats?sellerId=${sellerId}`)
      if (!res.ok) throw new Error('Failed to fetch seller stats')
      const data = await res.json()
      if (data.success && data.data) {
        set({ sellerStats: data.data as SellerStats })
      }
    } catch (error) {
      console.error('Failed to fetch seller stats:', error)
    }
  },
})
