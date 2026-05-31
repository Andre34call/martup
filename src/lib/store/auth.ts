import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import { signOut } from 'next-auth/react'
import type { AuthSlice, AppStore } from './types'
import type { UserRole, Seller } from '../types'
import { apiClient } from '@/lib/api-client'
import { useCartStore } from './cart'
import { mapSeller } from '../mappers'
import { deleteAuthFlagCookie } from '@/lib/session-cookie'

// API response types
type UserDataApiResponse = { data?: any; [key: string]: any }

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set, get) => ({
  isAuthenticated: false,
  currentUser: null,
  userRole: 'buyer' as UserRole,
  originalRole: 'buyer' as UserRole,
  isSuperAdminUser: false,

  login: (user) => {
    // Clear any stale reset token on login (both Zustand and sessionStorage)
    try { if (typeof window !== 'undefined') sessionStorage.removeItem('martup_reset_token') } catch { /* ignore */ }
    set({
      isAuthenticated: true,
      currentUser: user,
      userRole: user.role,
      originalRole: user.role, // Preserve the original DB role for role switching
      isSuperAdminUser: user.isSuperAdmin ?? false, // Set from API response
      currentScreen: 'home',
      avatarUrl: user.avatar || null,
      resetPasswordToken: '', // Clear any stale reset token on login
    })
  },

  logout: async () => {
    // Call server logout to clear httpOnly session cookies
    try {
      await apiClient.post('/api/auth/logout')
    } catch (err) {
      logger.warn({ component: 'auth', err }, 'Failed to call server logout endpoint')
    }
    // Clear client-side auth flag cookie
    deleteAuthFlagCookie()
    // Clear any stale localStorage tokens (from older sessions)
    localStorage.removeItem('authToken')
    localStorage.removeItem('martup_token')
    // Sign out from NextAuth to clear the session cookie
    // This prevents DataFetcher from re-authenticating the user
    try {
      await signOut({ redirect: false })
    } catch {
      // signOut may fail if there's no active session, that's OK
    }
    set({
      isAuthenticated: false,
      currentUser: null,
      userRole: 'buyer',
      originalRole: 'buyer',
      isSuperAdminUser: false,
      currentScreen: 'login',
      orders: [],
      notifications: [],
      unreadNotificationCount: 0,
      addresses: [],
      walletBalance: 0,
      walletHoldBalance: 0,
      walletMutations: [],
      reviews: [],
      followedStoreIds: [],
      seller: null,
      sellerStats: null,
      isDataLoaded: false,
      isSettingsLoaded: false,
      sellerBalance: { availableBalance: 0, pendingBalance: 0, holdBalance: 0, totalBalance: 0, totalWithdrawn: 0 },
      sellerBankAccounts: [],
      withdrawRequests: [],
      adminUsers: [],
      adminBanners: [],
      adminComplaints: [],
      adminStats: null,
      divisions: [],
      platformSettings: null,
      chatRooms: [],
      chatMessages: {},
      totalUnreadChats: 0,
      selectedVoucher: null,
      usedVoucherIds: [],
      vouchers: [],
      searchQuery: '',
      homeBanners: [],
    })
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

      try {
        // Try to register as seller — rawPost to check data.success and status code
        const registerRes = await apiClient.rawPost('/api/seller/register', { userId, storeName })
        const registerData = await registerRes.json()

        if (registerData.success && registerData.data) {
          // New seller registered successfully
          const seller = mapSeller(registerData.data)
          set({ seller })
        } else if (registerRes.status === 409) {
          // Already a seller — fetch existing seller data
          try {
            const userDataRaw = await apiClient.get<UserDataApiResponse>('/api/user-data', { userId })
            const userData = userDataRaw.data || userDataRaw

            if (userData.seller) {
              const seller = mapSeller(userData.seller)
              set({ seller })

              // Also update seller balance from wallet
              if (userData.seller.wallet) {
                const walletBal = userData.seller.wallet.balance || 0
                const walletHold = userData.seller.wallet.holdBalance || 0
                const walletPending = userData.seller.wallet.pendingBalance || 0
                set({
                  sellerBalance: {
                    availableBalance: walletBal,
                    pendingBalance: walletPending,
                    holdBalance: walletHold,
                    totalBalance: walletBal + walletHold + walletPending,
                    totalWithdrawn: 0,
                  }
                })
              }
            } else {
              // Seller 409 but no seller data in user-data response
              // Try re-fetching via fetchUserData which is more comprehensive
              logger.warn({ component: 'auth' }, 'Seller 409 but no seller data in user-data response — trying fetchUserData')
              await get().fetchUserData(userId)
            }
          } catch (fetchErr) {
            logger.warn({ component: 'auth', err: fetchErr }, 'Failed to fetch existing seller data — trying fetchUserData')
            // Last resort: try fetchUserData which handles all data including seller
            try {
              await get().fetchUserData(userId)
            } catch (retryErr) {
              logger.warn({ component: 'auth', err: retryErr }, 'fetchUserData also failed')
            }
          }
        } else {
          // Registration failed with a non-409 error
          logger.warn({ component: 'auth', status: registerRes.status, error: registerData.error }, 'Seller registration returned non-success')
        }
      } catch (err) {
        logger.warn({ component: 'auth', err }, 'Auto seller register via rawPost failed — trying fetchUserData fallback')
        // If rawPost fails (e.g., CSRF issues), try fetching existing seller data directly
        // This handles the case where the user is already a seller but the POST fails
        try {
          await get().fetchUserData(userId)
        } catch (fetchErr) {
          logger.warn({ component: 'auth', err: fetchErr }, 'fetchUserData fallback also failed')
        }
        // Don't navigate to seller dashboard if registration failed
        if (!get().seller) {
          set({ isLoading: false })
          throw new Error('Gagal mendaftar sebagai seller. Silakan coba lagi.')
        }
      }
    }

    // If seller registration was supposed to happen but still no seller record, don't navigate
    if (role === 'seller' && !get().seller) {
      set({ isLoading: false })
      throw new Error('Gagal mendaftar sebagai seller. Silakan coba lagi.')
    }

    // Determine the target screen based on the role
    // For Super Admin (admin role), navigate to admin-dashboard
    // For managers, navigate to admin-dashboard
    // For regular admins, navigate to admin-dashboard
    let targetScreen: string
    if (role === 'buyer') {
      targetScreen = 'home'
    } else if (role === 'seller') {
      targetScreen = 'seller-dashboard'
    } else if (['admin', 'manager'].includes(role)) {
      targetScreen = 'admin-dashboard'
    } else {
      targetScreen = 'home'
    }

    // IMPORTANT: Only update userRole (view-level), NOT currentUser.role (DB identity)
    // This preserves the original role so users can switch back to admin/manager
    set({
      userRole: role,
      // DO NOT mutate currentUser.role — keep the original DB role intact
      currentScreen: targetScreen as any,
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
    deleteAuthFlagCookie()
    localStorage.removeItem('authToken')
    localStorage.removeItem('martup_token')
    try {
      await signOut({ redirect: false })
    } catch {
      // signOut may fail if there's no active session, that's OK
    }
    set({
      isAuthenticated: false,
      currentUser: null,
      userRole: 'buyer',
      originalRole: 'buyer',
      isSuperAdminUser: false,
      currentScreen: 'login',
      orders: [],
      notifications: [],
      unreadNotificationCount: 0,
      addresses: [],
      walletBalance: 0,
      walletHoldBalance: 0,
      walletCoins: 0,
      walletMutations: [],
      reviews: [],
      followedStoreIds: [],
      seller: null,
      sellerStats: null,
      isDataLoaded: false,
      isSettingsLoaded: false,
      sellerBalance: { availableBalance: 0, pendingBalance: 0, holdBalance: 0, totalBalance: 0, totalWithdrawn: 0 },
      sellerBankAccounts: [],
      withdrawRequests: [],
      adminUsers: [],
      adminBanners: [],
      adminComplaints: [],
      adminStats: null,
      divisions: [],
      platformSettings: null,
      chatRooms: [],
      chatMessages: {},
      totalUnreadChats: 0,
      selectedVoucher: null,
      usedVoucherIds: [],
      vouchers: [],
      searchQuery: '',
      homeBanners: [],
    })
    // Clear cart store
    useCartStore.getState().clearCart()
  },
})
