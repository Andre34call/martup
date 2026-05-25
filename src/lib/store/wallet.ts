import type { StateCreator } from 'zustand'
import type { WalletSlice, AppStore } from './types'

export const createWalletSlice: StateCreator<AppStore, [], [], WalletSlice> = (set) => ({
  walletBalance: 0,
  walletHoldBalance: 0,
  walletCoins: 0,
  walletMutations: [],
  topUpWallet: (amount) => set((state) => {
    const newBalance = state.walletBalance + amount
    return {
      walletBalance: newBalance,
      walletMutations: [{
        id: `wm${Date.now()}`, type: 'credit', amount, balance: newBalance,
        description: `Top up MartUp Pay`, refType: 'deposit', createdAt: new Date().toISOString()
      }, ...state.walletMutations]
    }
  }),
  withdrawWallet: (amount, bankAccount) => set((state) => {
    if (amount > state.walletBalance) return state
    const newBalance = state.walletBalance - amount
    return {
      walletBalance: newBalance,
      walletMutations: [{
        id: `wm${Date.now()}`, type: 'debit', amount, balance: newBalance,
        description: `Tarik dana ke ${bankAccount}`, refType: 'withdrawal', createdAt: new Date().toISOString()
      }, ...state.walletMutations]
    }
  }),
  deductWallet: (amount, description) => set((state) => {
    if (amount > state.walletBalance) return state
    const newBalance = state.walletBalance - amount
    return {
      walletBalance: newBalance,
      walletMutations: [{
        id: `wm${Date.now()}`, type: 'debit', amount, balance: newBalance,
        description, refType: 'order', createdAt: new Date().toISOString()
      }, ...state.walletMutations]
    }
  }),
})
