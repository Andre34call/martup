import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import { signOut } from 'next-auth/react'
import type { AuthSlice, AppStore } from './types'
import type { UserRole } from '../types'
import { apiClient } from '@/lib/api-client'
import { useCartStore } from './cart'
import { deleteAuthFlagCookie } from '@/lib/session-cookie'
import { mapSellerWalletToBalance, getResetState } from '@/lib/store-helpers'
import type { UserDataResponse, SellerWithWallet } from '@/lib/api-types'
import { mapSeller } from '../mappers'

// Auth screens that should trigger redirect to home on login
const AUTH_SCREENS = new Set([
  'splash', 'onboarding', 'login', 'register', 'otp',
  'forgot-password', 'reset-password', 'email-verification',
])

// Shared client-side cleanup: clear cookies, localStorage, NextAuth session
async function clearClientAuthState() {
  deleteAuthFlagCookie()
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken')
    localStorage.removeItem('martup_token')
  }
  try {
    await signOut({ redirect: false })
  } catch {
    // signOut may fail if there's no active session, that's OK
  }
}

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set, get) => ({
  isAuthenticated: false,
  currentUser: null,
  userRole: 'buyer' as UserRole,
  originalRole: 'buyer' as UserRole,
  isSuperAdminUser: false,

  login: (user) => {
    // Clear any stale reset token on login (both Zustand and sessionStorage)
    try { if (typeof window !== 'undefined') sessionStorage.removeItem('martup_reset_token') } catch { /* ignore */ }
    // Only redirect to Home if the user is on an auth/splash screen.
    // Preserve currentScreen if the user is already on an authenticated screen
    // (e.g., session refresh while on Stream, Category, etc.)
    const currentScreen = get().currentScreen
    const shouldRedirectHome = AUTH_SCREENS.has(currentScreen)
    set({
      isAuthenticated: true,
      currentUser: user,
      userRole: user.role,
      originalRole: user.role,
      isSuperAdminUser: user.isSuperAdmin ?? false,
      currentScreen: shouldRedirectHome ? 'home' : currentScreen,
      avatarUrl: user.avatar || null,
      resetPasswordToken: '',
    })
  },

  logout: async () => {
    // Call server logout to clear httpOnly session cookies
    try {
      await apiClient.post('/api/auth/logout')
    } catch (err) {
      logger.warn({ component: 'auth', err }, 'Failed to call server logout endpoint')
    }
    await clearClientAuthState()
    set(getResetState())
    // Clear cart store
    useCartStore.getState().clearCart()
  },

  switchRole: async (role: UserRole) => {
    const state = get()
    set({ isLoading: true })

    // If switching to seller, ensure seller record exists before navigating
    if (role === 'seller' && state.currentUser && !state.seller) {
      const userId = state.currentUser.id
      const storeName = state.currentUser.name ? `${state.currentUser.name}'s Store` : 'My Store'
      let lastError: string | null = null

      // Pre-check: try to fetch existing seller data first before attempting registration
      try {
        const userDataRaw = await apiClient.get<UserDataResponse>('/api/user-data', { userId })
        const userData = userDataRaw.data
        if (userData?.seller) {
          const seller = mapSeller(userData.seller as unknown as Record<string, unknown>)
          set({ seller })

          // Also update seller balance from wallet
          const sellerWithWallet = userData.seller as unknown as SellerWithWallet
          if (sellerWithWallet.wallet) {
            set({
              sellerBalance: mapSellerWalletToBalance(sellerWithWallet.wallet),
            })
          }
        }
      } catch (preCheckErr) {
        logger.warn({ component: 'auth', err: preCheckErr }, 'Pre-check for existing seller data failed')
      }

      // Only attempt registration if pre-check didn't find existing seller data
      if (!get().seller) {
        try {
          const registerRes = await apiClient.rawPost('/api/seller/register', { userId, storeName })
          const registerData = await registerRes.json()

          if (registerData.success && registerData.data) {
            const seller = mapSeller(registerData.data)
            set({ seller })
          } else if (registerRes.status === 409) {
            // Already a seller — fetch existing seller data
            try {
              const userDataRaw = await apiClient.get<UserDataResponse>('/api/user-data', { userId })
              const userData = userDataRaw.data

              if (userData?.seller) {
                const seller = mapSeller(userData.seller as unknown as Record<string, unknown>)
                set({ seller })

                // Also update seller balance from wallet
                const sellerWithWallet = userData.seller as unknown as SellerWithWallet
                if (sellerWithWallet.wallet) {
                  set({
                    sellerBalance: mapSellerWalletToBalance(sellerWithWallet.wallet),
                  })
                }
              } else {
                logger.warn({ component: 'auth' }, 'Seller 409 but no seller data in user-data response — trying fetchUserData')
                await get().fetchUserData(userId)
              }
            } catch (fetchErr) {
              logger.warn({ component: 'auth', err: fetchErr }, 'Failed to fetch existing seller data — trying fetchUserData')
              try {
                await get().fetchUserData(userId)
              } catch (retryErr) {
                logger.warn({ component: 'auth', err: retryErr }, 'fetchUserData also failed')
              }
            }
          } else {
            lastError = registerData.error || `Registration failed (status ${registerRes.status})`
            logger.warn({ component: 'auth', status: registerRes.status, error: registerData.error }, 'Seller registration returned non-success')
          }
        } catch (err) {
          logger.warn({ component: 'auth', err }, 'Auto seller register via rawPost failed — trying fetchUserData fallback')
          try {
            await get().fetchUserData(userId)
          } catch (fetchErr) {
            logger.warn({ component: 'auth', err: fetchErr }, 'fetchUserData fallback also failed')
          }
          if (err instanceof Error) {
            lastError = err.message
          }
        }
      }

      // Don't navigate to seller dashboard if registration failed
      if (!get().seller) {
        set({ isLoading: false })
        if (lastError) {
          if (lastError.toLowerCase().includes('csrf') || lastError.toLowerCase().includes('validasi keamanan')) {
            throw new Error('Validasi keamanan gagal. Silakan refresh halaman dan coba lagi.')
          }
          if (lastError.includes('401') || lastError.toLowerCase().includes('autentikasi') || lastError.toLowerCase().includes('login') || lastError.toLowerCase().includes('sesi')) {
            throw new Error('Sesi Anda telah berakhir. Silakan login kembali.')
          }
          if (lastError.toLowerCase().includes('already registered') || lastError.toLowerCase().includes('sudah')) {
            throw new Error('Anda sudah terdaftar sebagai seller. Muat ulang halaman.')
          }
          throw new Error(lastError)
        }
        throw new Error('Gagal mendaftar sebagai seller. Silakan coba lagi.')
      }
    }

    // Determine the target screen based on the role
    const adminRoles = ['admin', 'manager', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr']
    const roleScreenMap: Record<string, string> = {
      buyer: 'home',
      seller: 'seller-dashboard',
    }
    const targetScreen: string = adminRoles.includes(role) ? 'admin-dashboard' : (roleScreenMap[role] || 'home')

    // IMPORTANT: Only update userRole (view-level), NOT currentUser.role (DB identity)
    // This preserves the original role so users can switch back to admin/manager
    set({
      userRole: role,
      // DO NOT mutate currentUser.role — keep the original DB role intact
      currentScreen: targetScreen as AppStore['currentScreen'],
      isLoading: false,
    })

    // Fetch seller stats if switching to seller and seller is now available
    if (role === 'seller' && get().seller?.id) {
      get().fetchSellerStats()
    }
  },

  deleteAccount: async () => {
    const userId = get().currentUser?.id
    // Attempt to delete the account from the server
    if (userId) {
      try {
        await apiClient.del('/api/user/delete')
      } catch (err) {
        logger.warn({ component: 'auth', err }, 'Failed to delete account from server')
        // Continue with local cleanup even if server delete fails
      }
    }
    // Clear session cookies via server logout
    try {
      await apiClient.post('/api/auth/logout')
    } catch (err) {
      logger.warn({ component: 'auth', err }, 'Failed to call server logout during account deletion')
    }
    await clearClientAuthState()
    set(getResetState())
    // Clear cart store
    useCartStore.getState().clearCart()
  },
})
