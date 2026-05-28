import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import { signOut } from 'next-auth/react'
import type { AuthSlice, AppStore } from './types'
import type { UserRole, Seller } from '../types'
import { getAuthHeaders } from './getAuthHeaders'
import { useCartStore } from './cart'
import { mapSeller } from '../mappers'

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set, get) => ({
  isAuthenticated: false,
  currentUser: null,
  userRole: 'buyer' as UserRole,

  login: (user) => {
    // Clear any stale reset token on login (both Zustand and sessionStorage)
    try { if (typeof window !== 'undefined') sessionStorage.removeItem('martup_reset_token') } catch { /* ignore */ }
    set({
      isAuthenticated: true,
      currentUser: user,
      userRole: user.role,
      currentScreen: 'home',
      avatarUrl: user.avatar || null,
      resetPasswordToken: '', // Clear any stale reset token on login
    })
  },

  logout: async () => {
    // Clear auth tokens
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
        // Try to register as seller
        const registerRes = await fetch('/api/seller/register', {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({ userId, storeName }),
        })
        const registerData = await registerRes.json()

        if (registerData.success && registerData.data) {
          // New seller registered successfully
          const seller = mapSeller(registerData.data)
          set({ seller })
        } else if (registerRes.status === 409) {
          // Already a seller — fetch existing seller data
          try {
            const userDataRes = await fetch(`/api/user-data?userId=${userId}`, { headers: getAuthHeaders() })
            const userDataRaw = await userDataRes.json()
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
            }
          } catch (fetchErr) {
            logger.warn({ component: 'auth', err: fetchErr }, 'Failed to fetch existing seller data')
          }
        }
      } catch (err) {
        logger.warn({ component: 'auth', err }, 'Auto seller register failed')
      }
    }

    // Now navigate after seller data is resolved
    set({
      userRole: role,
      currentUser: get().currentUser ? { ...get().currentUser!, role } : null,
      currentScreen: role === 'buyer' ? 'home' : role === 'seller' ? 'seller-dashboard' : ['admin', 'manager'].includes(role) ? 'admin-dashboard' : 'home',
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
        await fetch('/api/user/delete', {
          method: 'DELETE',
          headers: getAuthHeaders(true),
        })
      } catch (err) {
        logger.warn({ component: 'auth', err }, 'Failed to delete account from server')
        // Continue with local cleanup even if server delete fails
      }
    }
    // Clear auth tokens
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
