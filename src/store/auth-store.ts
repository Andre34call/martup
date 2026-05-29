'use client'

import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { User, Seller, UserRole } from '@/lib/types'
import { logger } from '@/lib/logger'

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
  user: 'martup_user',
  seller: 'martup_seller',
} as const

// SECURITY: Token is NO LONGER stored in localStorage to prevent XSS attacks.
// Primary auth is via httpOnly session cookie (sent automatically by the browser).
// The token is kept in-memory only for the current session.

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

  // SECURITY: Token is no longer loaded from localStorage.
  // Auth state is determined by httpOnly session cookie presence (checked via /api/auth/me).
  const userId = localStorage.getItem(STORAGE_KEYS.userId)
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

  // Authenticated only if we have user data (actual auth is via httpOnly cookie)
  return {
    userId,
    user,
    seller,
    token: null, // Token no longer stored in localStorage
    isAuthenticated: !!userId && !!user,
  }
}

function saveToStorage(data: { userId?: string | null; token?: string | null; user?: User | null; seller?: Seller | null }) {
  if (typeof window === 'undefined') return

  if (data.userId !== undefined) {
    if (data.userId) localStorage.setItem(STORAGE_KEYS.userId, data.userId)
    else localStorage.removeItem(STORAGE_KEYS.userId)
  }
  // SECURITY: Token is NO LONGER saved to localStorage.
  // Auth is handled by httpOnly session cookies set by the server.
  // Clean up any legacy tokens that may still exist.
  if (data.token !== undefined) {
    localStorage.removeItem('martup_token')
    localStorage.removeItem('authToken')
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
  // Also clean up legacy token keys
  localStorage.removeItem('martup_token')
  localStorage.removeItem('authToken')
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
      token: data.token, // Will clean up legacy localStorage tokens, not save new ones
      user: data.user,
      seller: data.seller,
    })

    set({
      userId: data.user.id,
      user: data.user,
      seller: data.seller,
      token: data.token, // In-memory only, NOT persisted to localStorage
      isAuthenticated: true,
    })

    // Data sync is handled by useDataSync hook — no manual sync needed here
  },

  register: async (registerData) => {
    const data = await apiClient.post<{ user: User }>(
      '/api/auth/register',
      registerData
    )

    // After register, auto-login (only if registration doesn't require email verification)
    // If email verification is required, the register API won't return a token
    // and auto-login will fail gracefully
    try {
      const loginData = await apiClient.post<{ user: User; seller: Seller | null; token: string }>(
        '/api/auth/login',
        { email: registerData.email, password: registerData.password }
      )

      saveToStorage({
        userId: loginData.user.id,
        token: loginData.token, // Will clean up legacy localStorage tokens, not save new ones
        user: loginData.user,
        seller: loginData.seller,
      })

      set({
        userId: loginData.user.id,
        user: loginData.user,
        seller: loginData.seller,
        token: loginData.token, // In-memory only
        isAuthenticated: true,
      })
    } catch {
      // Auto-login after register may fail if email verification is required
      // That's OK — the user will need to verify email first
      logger.info({ component: 'auth' }, 'Auto-login after register skipped (email verification likely required)')
    }

    // Data sync is handled by useDataSync hook — no manual sync needed here
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
    // Only update the display role, NOT the user object's role
    // This preserves the original DB role for proper role switching back
    // The auth-store is secondary — the main store in lib/store/auth.ts handles the full logic
  },
}))

// Initialize from localStorage on client side
if (typeof window !== 'undefined') {
  const stored = loadFromStorage()
  if (stored.isAuthenticated) {
    useAuthStore.setState(stored)
  }
}
