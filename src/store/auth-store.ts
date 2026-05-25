'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import { useAppStore, useCartStore, useWishlistStore } from '@/lib/store'
import type { User, Seller, UserRole } from '@/lib/types'

// ==================== AUTH STORE ====================

interface AuthState {
  userId: string | null
  user: User | null
  seller: Seller | null
  token: string | null
  isAuthenticated: boolean

  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (data: { name: string; email: string; phone?: string; password: string; role?: UserRole }) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  setUser: (user: User) => void
  setSeller: (seller: Seller | null) => void
  switchRole: (role: UserRole) => void
}

const STORAGE_KEYS = {
  userId: 'martup_user_id',
  token: 'martup_token',
  user: 'martup_user',
  seller: 'martup_seller',
} as const

function loadFromStorage(): Partial<AuthState> {
  if (typeof window === 'undefined') {
    return {
      userId: null,
      user: null,
      seller: null,
      token: null,
      isAuthenticated: false,
    }
  }

  const userId = localStorage.getItem(STORAGE_KEYS.userId)
  const token = localStorage.getItem(STORAGE_KEYS.token)
  const userJson = localStorage.getItem(STORAGE_KEYS.user)
  const sellerJson = localStorage.getItem(STORAGE_KEYS.seller)

  let user: User | null = null
  let seller: Seller | null = null

  try {
    if (userJson) user = JSON.parse(userJson)
  } catch { /* ignore */ }
  try {
    if (sellerJson) seller = JSON.parse(sellerJson)
  } catch { /* ignore */ }

  return {
    userId,
    user,
    seller,
    token,
    isAuthenticated: !!token && !!user,
  }
}

function saveToStorage(data: { userId?: string | null; token?: string | null; user?: User | null; seller?: Seller | null }) {
  if (typeof window === 'undefined') return

  if (data.userId !== undefined) {
    if (data.userId) localStorage.setItem(STORAGE_KEYS.userId, data.userId)
    else localStorage.removeItem(STORAGE_KEYS.userId)
  }
  if (data.token !== undefined) {
    if (data.token) localStorage.setItem(STORAGE_KEYS.token, data.token)
    else localStorage.removeItem(STORAGE_KEYS.token)
  }
  if (data.user !== undefined) {
    if (data.user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user))
    else localStorage.removeItem(STORAGE_KEYS.user)
  }
  if (data.seller !== undefined) {
    if (data.seller) localStorage.setItem(STORAGE_KEYS.seller, JSON.stringify(data.seller))
    else localStorage.removeItem(STORAGE_KEYS.seller)
  }
}

function clearStorage() {
  if (typeof window === 'undefined') return
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
}

/**
 * Sync all stores with API data for the given userId.
 * Called after successful login/register to ensure stores are populated.
 */
function syncAllStores(userId: string) {
  Promise.all([
    useAppStore.getState().loadFromApi(userId),
    useCartStore.getState().loadFromApi(userId),
    useWishlistStore.getState().loadFromApi(userId),
  ]).catch((err) => {
    console.error('Failed to sync stores after auth:', err)
  })
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userId: null,
  user: null,
  seller: null,
  token: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const data = await apiClient.post<{ user: User; seller: Seller | null; token: string }>(
      '/api/auth/login',
      { email, password }
    )

    saveToStorage({
      userId: data.user.id,
      token: data.token,
      user: data.user,
      seller: data.seller,
    })

    set({
      userId: data.user.id,
      user: data.user,
      seller: data.seller,
      token: data.token,
      isAuthenticated: true,
    })

    // Trigger data sync after login
    syncAllStores(data.user.id)
  },

  register: async (registerData) => {
    const data = await apiClient.post<{ user: User }>(
      '/api/auth/register',
      registerData
    )

    // After register, auto-login
    const loginData = await apiClient.post<{ user: User; seller: Seller | null; token: string }>(
      '/api/auth/login',
      { email: registerData.email, password: registerData.password }
    )

    saveToStorage({
      userId: loginData.user.id,
      token: loginData.token,
      user: loginData.user,
      seller: loginData.seller,
    })

    set({
      userId: loginData.user.id,
      user: loginData.user,
      seller: loginData.seller,
      token: loginData.token,
      isAuthenticated: true,
    })

    // Trigger data sync after register + auto-login
    syncAllStores(loginData.user.id)
  },

  logout: () => {
    clearStorage()
    set({
      userId: null,
      user: null,
      seller: null,
      token: null,
      isAuthenticated: false,
    })

    // Reset data loaded flag so next login re-fetches
    useAppStore.setState({ isDataLoaded: false })
  },

  fetchMe: async () => {
    const token = get().token
    if (!token) return

    try {
      const data = await apiClient.get<{ user: User; seller: Seller | null }>('/api/auth/me')

      saveToStorage({
        user: data.user,
        seller: data.seller,
      })

      set({
        user: data.user,
        seller: data.seller,
      })
    } catch {
      // Token might be invalid, logout
      get().logout()
    }
  },

  setUser: (user) => {
    saveToStorage({ user })
    set({ user })
  },

  setSeller: (seller) => {
    saveToStorage({ seller })
    set({ seller })
  },

  switchRole: (role) => {
    const currentUser = get().user
    if (!currentUser) return
    const updatedUser = { ...currentUser, role }
    saveToStorage({ user: updatedUser })
    set({ user: updatedUser })
  },
}))

// Initialize from localStorage on client side
if (typeof window !== 'undefined') {
  const stored = loadFromStorage()
  if (stored.isAuthenticated) {
    useAuthStore.setState(stored)
  }
}
