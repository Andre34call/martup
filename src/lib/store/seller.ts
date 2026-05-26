import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { SellerSlice, AppStore } from './types'
import type { WithdrawRequest, WithdrawStatus, SellerStats } from '../types'
import { getAuthHeaders } from './getAuthHeaders'

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
  requestWithdraw: async (amount, bankAccountId) => {
    try {
      const state = get()
      const bankAccount = state.sellerBankAccounts.find(a => a.id === bankAccountId)

      const body: Record<string, unknown> = { amount }
      if (bankAccount) {
        body.bankAccount = bankAccount.accountNumber
        body.bankName = bankAccount.bankName
        body.bankHolder = bankAccount.accountHolder
      }

      const res = await fetch('/api/seller/withdraw', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to request withdrawal')
      }
      const data = await res.json()
      const serverWithdrawal: WithdrawRequest = data.data

      // Update local state with server response
      set((state) => ({
        withdrawRequests: [serverWithdrawal, ...state.withdrawRequests],
        sellerBalance: {
          ...state.sellerBalance,
          availableBalance: state.sellerBalance.availableBalance - amount,
          holdBalance: state.sellerBalance.holdBalance + amount,
          totalBalance: (state.sellerBalance.availableBalance - amount) + state.sellerBalance.pendingBalance + (state.sellerBalance.holdBalance + amount),
        },
      }))
    } catch (error) {
      logger.warn({ component: 'seller', err: error }, 'requestWithdraw error')
      throw error
    }
  },
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
      logger.warn({ component: 'seller', err: error }, 'Failed to fetch seller stats')
    }
  },
  fetchWithdrawHistory: async (sellerId) => {
    try {
      const res = await fetch(`/api/seller/withdraw?sellerId=${encodeURIComponent(sellerId)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch withdraw history')
      }
      const data = await res.json()
      const serverWithdrawals: WithdrawRequest[] = data.data?.withdrawals || data.data || []
      set({ withdrawRequests: serverWithdrawals })
    } catch (error) {
      logger.warn({ component: 'seller', err: error }, 'fetchWithdrawHistory error')
      throw error
    }
  },
})
