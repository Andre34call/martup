import type { StateCreator } from 'zustand'
import type { WalletSlice, AppStore } from './types'
import { getAuthHeaders } from './getAuthHeaders'

export const createWalletSlice: StateCreator<AppStore, [], [], WalletSlice> = (set, get) => ({
  walletBalance: 0,
  walletHoldBalance: 0,
  walletCoins: 0,
  walletMutations: [],
  isWalletLoaded: false,

  topUpWallet: async (amount, method = 'bank_transfer') => {
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ amount, method }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'Top up gagal'
        throw new Error(errorMsg)
      }

      // API creates a PENDING deposit — do NOT increment balance until admin approves
      // Add a pending mutation to local state for UI feedback
      set((state) => ({
        walletMutations: [{
          id: data.data?.depositId || `wm${Date.now()}`,
          type: 'credit' as const,
          amount,
          balance: state.walletBalance,
          description: `Top up via ${method} — menunggu pembayaran`,
          refType: 'deposit',
          createdAt: new Date().toISOString(),
        }, ...state.walletMutations],
      }))
    } catch (error: unknown) {
      // Don't update local state on failure — re-throw so caller can handle
      throw error
    }
  },

  withdrawWallet: async (amount, _bankAccount, bankDetails) => {
    try {
      const body: Record<string, unknown> = { amount }

      // Include bank details if provided — the API requires them
      if (bankDetails) {
        body.bankAccount = bankDetails.bankAccount
        body.bankName = bankDetails.bankName
        body.bankHolder = bankDetails.bankHolder
      }

      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'Penarikan gagal'
        throw new Error(errorMsg)
      }

      // On success: balance decremented + holdBalance incremented on server
      // Update local state to reflect the escrow move
      set((state) => {
        const newBalance = state.walletBalance - amount
        const newHoldBalance = state.walletHoldBalance + amount
        return {
          walletBalance: newBalance,
          walletHoldBalance: newHoldBalance,
          walletMutations: [{
            id: data.data?.id || `wm${Date.now()}`,
            type: 'debit' as const,
            amount,
            balance: newBalance,
            description: `Penarikan dana (menunggu persetujuan admin)`,
            refType: 'withdraw',
            createdAt: new Date().toISOString(),
          }, ...state.walletMutations],
        }
      })
    } catch (error: unknown) {
      // Don't update local state on failure — re-throw so caller can handle
      throw error
    }
  },

  deductWallet: (amount, description) => {
    // This is used during checkout for wallet payment.
    // The actual API call happens in checkout-screen.tsx.
    // Keep as local-only update.
    set((state) => {
      if (amount > state.walletBalance) return state
      const newBalance = state.walletBalance - amount
      return {
        walletBalance: newBalance,
        walletMutations: [{
          id: `wm${Date.now()}`, type: 'debit' as const, amount, balance: newBalance,
          description, refType: 'order', createdAt: new Date().toISOString()
        }, ...state.walletMutations]
      }
    })
  },

  fetchWalletBalance: async (userId) => {
    try {
      const res = await fetch(`/api/wallet?userId=${encodeURIComponent(userId)}`, {
        headers: getAuthHeaders(),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        // Wallet not found is ok — may not exist yet
        return
      }

      const wallet = data.data
      set({
        walletBalance: Number(wallet.balance) || 0,
        walletHoldBalance: Number(wallet.holdBalance) || 0,
        walletCoins: Number(wallet.coins) || 0,
        isWalletLoaded: true,
        // Include mutations if returned by the wallet endpoint
        ...(wallet.mutations ? {
          walletMutations: wallet.mutations.map((m: Record<string, unknown>) => ({
            id: String(m.id),
            type: m.type as 'credit' | 'debit',
            amount: Number(m.amount),
            balance: Number(m.balance),
            description: String(m.description || ''),
            refType: m.refType ? String(m.refType) : undefined,
            createdAt: m.createdAt ? String(m.createdAt) : new Date().toISOString(),
          })),
        } : {}),
      })
    } catch {
      // Silently fail — local state remains
    }
  },

  fetchWalletMutations: async (userId) => {
    try {
      const res = await fetch(`/api/wallet/mutations?userId=${encodeURIComponent(userId)}`, {
        headers: getAuthHeaders(),
      })

      const data = await res.json()

      if (!res.ok) {
        return
      }

      // The mutations endpoint returns { items, total, page, limit, totalPages }
      const mutations = data.items || data.mutations || data
      if (Array.isArray(mutations)) {
        set({
          walletMutations: mutations.map((m: Record<string, unknown>) => ({
            id: String(m.id),
            type: m.type as 'credit' | 'debit',
            amount: Number(m.amount),
            balance: Number(m.balance),
            description: String(m.description || ''),
            refType: m.refType ? String(m.refType) : undefined,
            createdAt: m.createdAt ? String(m.createdAt) : new Date().toISOString(),
          })),
        })
      }
    } catch {
      // Silently fail — local state remains
    }
  },
})
