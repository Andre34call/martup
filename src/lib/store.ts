import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { signOut } from 'next-auth/react'
import type { ScreenName, UserRole, User, CartItem, Product, ProductVariant, Notification as AppNotification, ChatRoom, ChatMessage, Address, Voucher, Order, OrderStatus, WalletMutation, BankAccount, WithdrawRequest, WithdrawStatus, SellerBalance, Review, Seller, Division, SellerStats, AdminStats } from './types'

// ==================== APP STORE ====================
interface AppState {
  // Navigation
  currentScreen: ScreenName
  previousScreens: ScreenName[]
  navigate: (screen: ScreenName) => void
  goBack: () => void

  // Auth
  isAuthenticated: boolean
  currentUser: User | null
  userRole: UserRole
  login: (user: User) => void
  logout: () => Promise<void>
  switchRole: (role: UserRole) => Promise<void>

  // Selected items
  selectedProductId: string | null
  selectedCategoryId: string | null
  selectedOrderId: string | null
  selectedChatRoomId: string | null
  selectedSellerId: string | null
  setSelectedProduct: (id: string | null) => void
  setSelectedCategory: (id: string | null) => void
  setSelectedOrder: (id: string | null) => void
  setSelectedChatRoom: (id: string | null) => void
  setSelectedSeller: (id: string | null) => void

  // UI state
  isLoading: boolean
  showSplash: boolean
  setShowSplash: (v: boolean) => void

  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  hideToast: () => void

  // Notifications
  notifications: AppNotification[]
  unreadNotificationCount: number
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void

  // Chat
  chatRooms: ChatRoom[]
  chatMessages: Record<string, ChatMessage[]>
  totalUnreadChats: number
  addChatMessage: (roomId: string, message: ChatMessage) => void
  addChatRoom: (room: ChatRoom) => void
  markChatRead: (roomId: string) => void
  fetchChatRooms: () => Promise<void>
  fetchChatMessages: (roomId: string) => Promise<void>
  sendChatMessage: (roomId: string, content: string, type?: string) => Promise<void>
  createChatRoom: (sellerId: string, productId?: string) => Promise<string | null>

  // Orders
  orders: Order[]
  addOrder: (order: Order) => void
  updateOrderStatus: (orderId: string, status: OrderStatus) => void
  payForOrder: (orderId: string) => void
  cancelOrder: (orderId: string) => void
  updateOrderTracking: (orderId: string, trackingNumber: string) => void

  // Address
  addresses: Address[]
  selectedAddressId: string | null
  addAddress: (address: Address) => void
  updateAddress: (address: Address) => void
  deleteAddress: (id: string) => void
  setDefaultAddress: (id: string) => void

  // Wallet
  walletBalance: number
  walletHoldBalance: number
  walletCoins: number
  walletMutations: WalletMutation[]
  topUpWallet: (amount: number) => void
  withdrawWallet: (amount: number, bankAccount: string) => void
  deductWallet: (amount: number, description: string) => void

  // Vouchers
  vouchers: Voucher[]
  selectedVoucher: Voucher | null
  selectVoucher: (voucher: Voucher | null) => void
  usedVoucherIds: string[]
  useVoucher: (voucherId: string) => void

  // Followed stores
  followedStoreIds: string[]
  toggleFollowStore: (storeId: string) => void
  isFollowingStore: (storeId: string) => boolean

  // Search
  searchQuery: string
  searchHistory: string[]
  setSearchQuery: (q: string) => void
  addSearchHistory: (q: string) => void
  clearSearchHistory: () => void

  // Profile
  avatarUrl: string | null
  updateAvatar: (url: string | null) => void
  updateProfile: (data: { name?: string; email?: string; phone?: string }) => void

  // Seller Financial
  sellerBalance: SellerBalance
  sellerBankAccounts: BankAccount[]
  withdrawRequests: WithdrawRequest[]
  addBankAccount: (account: BankAccount) => void
  removeBankAccount: (id: string) => void
  setDefaultBankAccount: (id: string) => void
  requestWithdraw: (amount: number, bankAccountId: string) => void
  updateWithdrawStatus: (id: string, status: WithdrawStatus, rejectionReason?: string) => void
  getSellerAvailableForWithdraw: () => number

  // Products
  products: Product[]
  addProduct: (product: Product) => void
  updateProduct: (product: Product) => void
  removeProduct: (id: string) => void

  // Reviews
  reviews: Review[]
  reviewedOrderIds: string[]
  addReview: (review: Review, orderId: string) => void
  deleteReview: (reviewId: string) => void
  updateReview: (reviewId: string, updates: Partial<Review>) => void
  fetchProductReviews: (productId: string) => Promise<void>

  // Admin Users
  adminUsers: Array<{
    id: string
    name: string
    email: string
    phone: string
    role: string
    isVerified: boolean
    isBlocked: boolean
    joinDate: string
    totalSpent: number
    totalOrders: number
    divisionId?: string | null
  }>
  updateAdminUser: (userId: string, updates: Record<string, any>) => void
  deleteAdminUser: (userId: string) => void

  // Admin Banners
  adminBanners: Array<{
    id: string
    title: string
    image: string
    link: string
    position: string
    isActive: boolean
    sortOrder: number
    startDate?: string | null
    endDate?: string | null
  }>
  addAdminBanner: (banner: any) => void
  updateAdminBanner: (bannerId: string, updates: Record<string, any>) => void
  deleteAdminBanner: (bannerId: string) => void

  // Admin Complaints
  adminComplaints: Array<{
    id: string
    userId: string
    userName: string
    type: string
    description: string
    status: string
    createdAt: string
    response?: string
    orderId?: string
    buyer?: string
    seller?: string
  }>
  updateAdminComplaint: (complaintId: string, updates: Record<string, any>) => void

  // Admin Divisions
  divisions: Division[]
  fetchDivisions: () => Promise<void>
  fetchAdminUsers: () => Promise<void>
  assignUserToDivision: (userId: string, divisionId: string | null) => Promise<void>
  updateDivision: (divisionId: string, updates: Record<string, any>) => Promise<void>

  // Settings
  settings: {
    twoFactor: boolean
    pushNotif: boolean
    emailNotif: boolean
    dataSharing: boolean
  }
  updateSettings: (settings: Partial<AppState['settings']>) => void

  // Account
  deleteAccount: () => void

  // Admin Data Fetching
  adminStats: AdminStats | null
  fetchAdminStats: () => Promise<void>
  fetchAdminWithdrawals: () => Promise<void>
  fetchAdminBanners: () => Promise<void>
  fetchAdminComplaints: () => Promise<void>

  // Data fetching
  seller: Seller | null
  sellerStats: SellerStats | null
  fetchSellerStats: () => Promise<void>
  fetchUserData: (userId: string) => Promise<void>
  fetchProducts: () => Promise<void>
  fetchCategories: () => Promise<void>
  categories: Array<{ id: string; name: string; slug: string; icon?: string; image?: string; parentId?: string | null; productCount?: number; children?: Array<{ id: string; name: string; slug: string; icon?: string; parentId?: string | null; productCount?: number; children?: any[] }> }>
  isDataLoaded: boolean

  // Home Banners (public, from DB)
  homeBanners: Array<{ id: string; title: string; image: string; link: string; position: string }>
  fetchHomeBanners: () => Promise<void>
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

// Helper to get auth headers from localStorage for API calls
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }
  return headers
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      currentScreen: 'splash',
      previousScreens: [],
      navigate: (screen) => set((state) => ({
        currentScreen: screen,
        previousScreens: [...state.previousScreens, state.currentScreen]
      })),
      goBack: () => set((state) => {
        const prev = [...state.previousScreens]
        const lastScreen = prev.pop() || 'home'
        return { currentScreen: lastScreen, previousScreens: prev }
      }),

      // Auth
      isAuthenticated: false,
      currentUser: null,
      userRole: 'buyer',
      login: (user) => set({
        isAuthenticated: true,
        currentUser: user,
        userRole: user.role,
        currentScreen: 'home'
      }),
      logout: async () => {
        // Clear auth token
        localStorage.removeItem('authToken')
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
          sellerBalance: { availableBalance: 0, pendingBalance: 0, holdBalance: 0, totalBalance: 0, totalWithdrawn: 0 },
          sellerBankAccounts: [],
          withdrawRequests: [],
          adminUsers: [],
          adminBanners: [],
          adminComplaints: [],
          adminStats: null,
          divisions: [],
          chatRooms: [],
          chatMessages: {},
          totalUnreadChats: 0,
          selectedVoucher: null,
          usedVoucherIds: [],
          vouchers: [],
          searchQuery: '',
          homeBanners: [],
        })
        // Clear cart and wishlist stores
        useCartStore.getState().clearCart()
      },
      switchRole: async (role) => {
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
              headers: getAuthHeaders(),
              body: JSON.stringify({ userId, storeName }),
            })
            const registerData = await registerRes.json()

            if (registerData.success && registerData.data) {
              // New seller registered successfully
              const sellerData = registerData.data
              const seller: Seller = {
                id: sellerData.id,
                userId: sellerData.userId,
                storeName: sellerData.storeName,
                storeSlug: sellerData.storeSlug,
                storeDesc: sellerData.storeDesc || undefined,
                storeAvatar: sellerData.storeAvatar || undefined,
                storeBanner: sellerData.storeBanner || undefined,
                isVerified: sellerData.isVerified || false,
                isPremium: sellerData.isPremium || false,
                rating: sellerData.rating || 0,
                totalSales: sellerData.totalSales || 0,
                totalProducts: sellerData.totalProducts || 0,
                responseTime: sellerData.responseTime || undefined,
                bankName: sellerData.bankName || undefined,
                bankAccount: sellerData.bankAccount || undefined,
                bankHolder: sellerData.bankHolder || undefined,
                autoReply: sellerData.autoReply || undefined,
              }
              set({ seller })
            } else if (registerRes.status === 409) {
              // Already a seller — fetch existing seller data
              try {
                const userDataRes = await fetch(`/api/user-data?userId=${userId}`, { headers: getAuthHeaders() })
                const userDataRaw = await userDataRes.json()
                const userData = userDataRaw.data || userDataRaw

                if (userData.seller) {
                  const s = userData.seller
                  const seller: Seller = {
                    id: s.id,
                    userId: s.userId,
                    storeName: s.storeName,
                    storeSlug: s.storeSlug,
                    storeDesc: s.storeDesc || undefined,
                    storeAvatar: s.storeAvatar || undefined,
                    storeBanner: s.storeBanner || undefined,
                    isVerified: s.isVerified,
                    isPremium: s.isPremium,
                    rating: s.rating,
                    totalSales: s.totalSales,
                    totalProducts: s.totalProducts,
                    responseTime: s.responseTime || undefined,
                    bankName: s.bankName || undefined,
                    bankAccount: s.bankAccount || undefined,
                    bankHolder: s.bankHolder || undefined,
                    autoReply: s.autoReply || undefined,
                  }
                  set({ seller })

                  // Also update seller balance from wallet
                  if (s.wallet) {
                    const walletBal = s.wallet.balance || 0
                    const walletHold = s.wallet.holdBalance || 0
                    const walletPending = s.wallet.pendingBalance || 0
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
                console.error('Failed to fetch existing seller data:', fetchErr)
              }
            }
          } catch (err) {
            console.error('Auto seller register failed:', err)
          }
        }

        // Now navigate after seller data is resolved
        set({
          userRole: role,
          currentUser: get().currentUser ? { ...get().currentUser!, role } : null,
          currentScreen: role === 'buyer' ? 'home' : role === 'seller' ? 'seller-dashboard' : 'admin-dashboard',
          isLoading: false,
        })

        // Fetch seller stats if switching to seller and seller is now available
        if (role === 'seller' && get().seller?.id) {
          get().fetchSellerStats()
        }
      },

      // Selected items
      selectedProductId: null,
      selectedCategoryId: null,
      selectedOrderId: null,
      selectedChatRoomId: null,
      selectedSellerId: null,
      setSelectedProduct: (id) => set({ selectedProductId: id }),
      setSelectedCategory: (id) => set({ selectedCategoryId: id }),
      setSelectedOrder: (id) => set({ selectedOrderId: id }),
      setSelectedChatRoom: (id) => set({ selectedChatRoomId: id }),
      setSelectedSeller: (id) => set({ selectedSellerId: id }),

      // UI state
      isLoading: false,
      showSplash: true,
      setShowSplash: (v) => set({ showSplash: v }),

      // Toast
      toast: null,
      showToast: (message, type = 'success') => {
        if (toastTimer) clearTimeout(toastTimer)
        set({ toast: { message, type } })
        toastTimer = setTimeout(() => set({ toast: null }), 2500)
      },
      hideToast: () => set({ toast: null }),

      // Notifications - START EMPTY for new users
      notifications: [],
      unreadNotificationCount: 0,
      markNotificationRead: (id) => set((state) => {
        const notification = state.notifications.find(n => n.id === id)
        if (!notification || notification.isRead) return state
        // Also update on server
        fetch('/api/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId: id }),
        }).catch(() => {})
        return {
          notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
          unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1)
        }
      }),
      markAllNotificationsRead: () => set((state) => {
        const userId = state.currentUser?.id
        if (userId) {
          fetch('/api/notifications', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markAll: true, userId }),
          }).catch(() => {})
        }
        return {
          notifications: state.notifications.map(n => ({ ...n, isRead: true })),
          unreadNotificationCount: 0
        }
      }),

      // Chat - START EMPTY
      chatRooms: [],
      chatMessages: {},
      totalUnreadChats: 0,
      addChatMessage: (roomId, message) => set((state) => ({
        chatMessages: {
          ...state.chatMessages,
          [roomId]: [...(state.chatMessages[roomId] || []), message],
        },
        chatRooms: state.chatRooms.map(r =>
          r.id === roomId
            ? { ...r, lastMessage: message.content, lastMessageTime: message.createdAt }
            : r
        ),
      })),
      addChatRoom: (room) => set((state) => ({
        chatRooms: [room, ...state.chatRooms],
      })),
      markChatRead: (roomId) => {
        // Mark as read on server
        fetch('/api/chat/messages', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ roomId }),
        }).catch(() => {})

        return set((state) => {
          const roomMessages = state.chatMessages[roomId]
          if (!roomMessages) return state

          const updatedMessages = {
            ...state.chatMessages,
            [roomId]: roomMessages.map(m => ({ ...m, isRead: true })),
          }

          const updatedRooms = state.chatRooms.map(r =>
            r.id === roomId ? { ...r, unreadCount: 0 } : r
          )

          const totalUnreadChats = updatedRooms.reduce((sum, r) => sum + r.unreadCount, 0)

          return {
            chatMessages: updatedMessages,
            chatRooms: updatedRooms,
            totalUnreadChats,
          }
        })
      },
      fetchChatRooms: async () => {
        try {
          const res = await fetch('/api/chat/rooms', { headers: getAuthHeaders() })
          if (!res.ok) throw new Error('Failed to fetch chat rooms')
          const data = await res.json()
          if (data.success && data.data) {
            const rooms: ChatRoom[] = (data.data as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => {
              const otherUser = r.otherUser as Record<string, unknown> | undefined
              const sellerData = (otherUser?.seller as Record<string, unknown>) || {}
              const productData = r.product as Record<string, unknown> | undefined
              return {
                id: r.id as string,
                seller: {
                  id: sellerData.id as string || otherUser?.id as string || '',
                  userId: otherUser?.id as string || '',
                  storeName: (otherUser?.name as string) || (sellerData.storeName as string) || 'Seller',
                  storeSlug: (sellerData.storeSlug as string) || '',
                  storeAvatar: (otherUser?.avatar as string) || (sellerData.storeAvatar as string) || undefined,
                  isVerified: (sellerData.isVerified as boolean) || false,
                  isPremium: (sellerData.isPremium as boolean) || false,
                  rating: (sellerData.rating as number) || 0,
                  totalSales: (sellerData.totalSales as number) || 0,
                  totalProducts: (sellerData.totalProducts as number) || 0,
                },
                lastMessage: (r.lastMessage as string) || '',
                lastMessageTime: (r.lastMessageTime as string) || (r.updatedAt as string) || new Date().toISOString(),
                unreadCount: (r.unreadCount as number) || 0,
                product: productData ? {
                  id: productData.id as string,
                  name: productData.name as string,
                  price: productData.price as number,
                  images: typeof productData.images === 'string' ? JSON.parse(productData.images) : (productData.images as string[]) || [],
                } as any : undefined,
              }
            })
            const totalUnreadChats = rooms.reduce((sum, r) => sum + r.unreadCount, 0)
            set({ chatRooms: rooms, totalUnreadChats })
          }
        } catch (error) {
          console.error('Fetch chat rooms error:', error)
        }
      },
      fetchChatMessages: async (roomId) => {
        try {
          const res = await fetch(`/api/chat/messages?roomId=${roomId}`, { headers: getAuthHeaders() })
          if (!res.ok) throw new Error('Failed to fetch chat messages')
          const data = await res.json()
          if (data.success && data.data) {
            const messages: ChatMessage[] = (data.data as Array<Record<string, unknown>>).map((m: Record<string, unknown>) => ({
              id: m.id as string,
              roomId: m.roomId as string || roomId,
              senderId: m.senderId as string,
              content: m.content as string,
              type: (m.type as ChatMessage['type']) || 'text',
              isRead: m.isRead as boolean,
              createdAt: m.createdAt as string,
            }))
            set((state) => ({
              chatMessages: {
                ...state.chatMessages,
                [roomId]: messages,
              },
            }))
          }
        } catch (error) {
          console.error('Fetch chat messages error:', error)
        }
      },
      sendChatMessage: async (roomId, content, type = 'text') => {
        // Optimistic local update first
        const tempMsg: ChatMessage = {
          id: `temp-${Date.now()}`,
          roomId,
          senderId: get().currentUser?.id || '',
          content,
          type: type as ChatMessage['type'],
          isRead: false,
          createdAt: new Date().toISOString(),
        }
        get().addChatMessage(roomId, tempMsg)

        try {
          const res = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ roomId, content, type }),
          })
          if (!res.ok) throw new Error('Failed to send message')
          const data = await res.json()
          // Replace temp message with real one from server
          if (data.success && data.data) {
            const m = data.data as Record<string, unknown>
            const realMsg: ChatMessage = {
              id: m.id as string,
              roomId: m.roomId as string || roomId,
              senderId: m.senderId as string,
              content: m.content as string,
              type: (m.type as ChatMessage['type']) || 'text',
              isRead: m.isRead as boolean,
              createdAt: m.createdAt as string,
            }
            set((state) => ({
              chatMessages: {
                ...state.chatMessages,
                [roomId]: (state.chatMessages[roomId] || []).map(msg =>
                  msg.id === tempMsg.id ? realMsg : msg
                ),
              },
            }))
          }
        } catch (error) {
          console.error('Send chat message error:', error)
        }
      },
      createChatRoom: async (sellerId, productId) => {
        try {
          const res = await fetch('/api/chat/rooms', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ sellerId, productId }),
          })
          if (!res.ok) throw new Error('Failed to create chat room')
          const data = await res.json()
          if (data.success && data.data) {
            const r = data.data as Record<string, unknown>
            const otherUser = r.otherUser as Record<string, unknown> | undefined
            const sellerData = (otherUser?.seller as Record<string, unknown>) || {}
            const productData = r.product as Record<string, unknown> | undefined
            const room: ChatRoom = {
              id: r.id as string,
              seller: {
                id: sellerData.id as string || otherUser?.id as string || '',
                userId: otherUser?.id as string || '',
                storeName: (otherUser?.name as string) || (sellerData.storeName as string) || 'Seller',
                storeSlug: (sellerData.storeSlug as string) || '',
                storeAvatar: (otherUser?.avatar as string) || (sellerData.storeAvatar as string) || undefined,
                isVerified: (sellerData.isVerified as boolean) || false,
                isPremium: (sellerData.isPremium as boolean) || false,
                rating: (sellerData.rating as number) || 0,
                totalSales: (sellerData.totalSales as number) || 0,
                totalProducts: (sellerData.totalProducts as number) || 0,
              },
              lastMessage: (r.lastMessage as string) || '',
              lastMessageTime: (r.lastMessageTime as string) || (r.updatedAt as string) || new Date().toISOString(),
              unreadCount: 0,
              product: productData ? {
                id: productData.id as string,
                name: productData.name as string,
                price: productData.price as number,
                images: typeof productData.images === 'string' ? JSON.parse(productData.images) : (productData.images as string[]) || [],
              } as any : undefined,
            }
            // Add to local state if not already present
            if (!get().chatRooms.find(cr => cr.id === room.id)) {
              get().addChatRoom(room)
            }
            return room.id
          }
          return null
        } catch (error) {
          console.error('Create chat room error:', error)
          return null
        }
      },

      // Orders - START EMPTY
      orders: [],
      addOrder: (order) => set((state) => {
        const sellerCredit = order.status === 'paid' ? order.subtotal * 0.95 : 0
        const newSellerBalance = sellerCredit > 0
          ? {
              ...state.sellerBalance,
              pendingBalance: state.sellerBalance.pendingBalance + sellerCredit,
              totalBalance: state.sellerBalance.availableBalance + state.sellerBalance.pendingBalance + sellerCredit + state.sellerBalance.holdBalance,
            }
          : state.sellerBalance

        const updatedProducts = state.products.map(p => {
          // Sum all quantities for this product (may have multiple variants)
          const totalQty = order.items
            .filter(item => item.productId === p.id)
            .reduce((sum, item) => sum + item.quantity, 0)
          if (totalQty === 0) return p

          const newStock = Math.max(0, p.stock - totalQty)

          const updatedVariants = p.variants.map(v => {
            const variantItem = order.items.find(item => item.variantId === v.id)
            if (!variantItem) return v
            return { ...v, stock: v.stock - variantItem.quantity }
          })

          return { ...p, stock: Math.max(0, newStock), variants: updatedVariants }
        })

        return {
          orders: [order, ...state.orders],
          sellerBalance: newSellerBalance,
          products: updatedProducts,
        }
      }),
      updateOrderStatus: (orderId, status) => set((state) => {
        const order = state.orders.find(o => o.id === orderId)
        if (!order) return state
        const prevStatus = order.status
        const sellerCredit = order.subtotal * 0.95
        let newSellerBalance = { ...state.sellerBalance }

        if (status === 'paid' && prevStatus !== 'paid') {
          newSellerBalance.pendingBalance += sellerCredit
        } else if (status === 'delivered') {
          newSellerBalance.pendingBalance -= sellerCredit
          newSellerBalance.availableBalance += sellerCredit
        } else if (status === 'cancelled' && (prevStatus === 'paid' || prevStatus === 'processing' || prevStatus === 'shipped')) {
          newSellerBalance.pendingBalance -= sellerCredit
        }

        newSellerBalance.totalBalance = newSellerBalance.availableBalance + newSellerBalance.pendingBalance + newSellerBalance.holdBalance

        return {
          orders: state.orders.map(o => o.id === orderId ? {
            ...o, status,
            ...(status === 'paid' ? { paymentStatus: 'paid', paidAt: new Date().toISOString() } : {}),
            ...(status === 'shipped' ? { shippedAt: new Date().toISOString() } : {}),
            ...(status === 'delivered' ? { deliveredAt: new Date().toISOString() } : {}),
          } : o),
          sellerBalance: newSellerBalance,
        }
      }),
      payForOrder: (orderId) => set((state) => {
        const order = state.orders.find(o => o.id === orderId)
        if (!order || order.status !== 'pending') return state

        const sellerCredit = order.subtotal * 0.95
        let newWalletBalance = state.walletBalance
        let newWalletMutations = [...state.walletMutations]

        if (order.paymentMethod?.toLowerCase() === 'wallet') {
          if (order.totalAmount > state.walletBalance) return state
          newWalletBalance = state.walletBalance - order.totalAmount
          newWalletMutations = [{
            id: `wm${Date.now()}`, type: 'debit' as const, amount: order.totalAmount, balance: newWalletBalance,
            description: `Pembayaran Order #${order.orderNumber}`, refType: 'order', createdAt: new Date().toISOString()
          }, ...state.walletMutations]
        }

        const newSellerBalance = {
          ...state.sellerBalance,
          pendingBalance: state.sellerBalance.pendingBalance + sellerCredit,
          totalBalance: state.sellerBalance.availableBalance + state.sellerBalance.pendingBalance + sellerCredit + state.sellerBalance.holdBalance,
        }

        return {
          orders: state.orders.map(o => o.id === orderId ? {
            ...o, status: 'paid' as OrderStatus, paymentStatus: 'paid', paidAt: new Date().toISOString(),
          } : o),
          walletBalance: newWalletBalance,
          walletMutations: newWalletMutations,
          sellerBalance: newSellerBalance,
        }
      }),
      cancelOrder: (orderId) => set((state) => {
        const order = state.orders.find(o => o.id === orderId)
        if (!order) return state

        const wasPaid = order.paymentStatus === 'paid' || order.status === 'paid' || order.status === 'processing' || order.status === 'shipped'
        const sellerCredit = order.subtotal * 0.95

        let newSellerBalance = { ...state.sellerBalance }
        let newWalletBalance = state.walletBalance
        let newWalletMutations = [...state.walletMutations]

        if (wasPaid) {
          newSellerBalance.pendingBalance -= sellerCredit
        }

        if (order.paymentMethod?.toLowerCase() === 'wallet' && wasPaid) {
          newWalletBalance = state.walletBalance + order.totalAmount
          newWalletMutations = [{
            id: `wm${Date.now()}`, type: 'credit' as const, amount: order.totalAmount, balance: newWalletBalance,
            description: `Refund Order #${order.orderNumber}`, refType: 'refund', createdAt: new Date().toISOString()
          }, ...state.walletMutations]
        }

        newSellerBalance.totalBalance = newSellerBalance.availableBalance + newSellerBalance.pendingBalance + newSellerBalance.holdBalance

        return {
          orders: state.orders.map(o => o.id === orderId ? {
            ...o, status: 'cancelled' as OrderStatus, paymentStatus: 'refunded',
          } : o),
          sellerBalance: newSellerBalance,
          walletBalance: newWalletBalance,
          walletMutations: newWalletMutations,
        }
      }),
      updateOrderTracking: (orderId, trackingNumber) => set((state) => ({
        orders: state.orders.map(o => o.id === orderId ? {
          ...o,
          shipping: o.shipping ? { ...o.shipping, trackingNumber } : undefined,
        } : o),
      })),

      // Address - START EMPTY
      addresses: [],
      selectedAddressId: null,
      addAddress: (address) => set((state) => {
        const addresses = address.isDefault
          ? state.addresses.map(a => ({ ...a, isDefault: false })).concat(address)
          : [...state.addresses, address]
        return { addresses, selectedAddressId: address.isDefault ? address.id : state.selectedAddressId }
      }),
      updateAddress: (address) => set((state) => ({
        addresses: state.addresses.map(a => a.id === address.id ? address : a)
      })),
      deleteAddress: (id) => set((state) => ({
        addresses: state.addresses.filter(a => a.id !== id)
      })),
      setDefaultAddress: (id) => set((state) => ({
        addresses: state.addresses.map(a => ({ ...a, isDefault: a.id === id })),
        selectedAddressId: id
      })),

      // Wallet - START AT 0
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

      // Vouchers - START EMPTY (fetched from API)
      vouchers: [],
      selectedVoucher: null,
      selectVoucher: (voucher) => set({ selectedVoucher: voucher }),
      usedVoucherIds: [],
      useVoucher: (voucherId) => set((state) => ({
        usedVoucherIds: state.usedVoucherIds.includes(voucherId)
          ? state.usedVoucherIds
          : [...state.usedVoucherIds, voucherId],
      })),

      // Followed stores - START EMPTY
      followedStoreIds: [],
      toggleFollowStore: (storeId) => set((state) => ({
        followedStoreIds: state.followedStoreIds.includes(storeId)
          ? state.followedStoreIds.filter(id => id !== storeId)
          : [...state.followedStoreIds, storeId]
      })),
      isFollowingStore: (storeId) => get().followedStoreIds.includes(storeId),

      // Search
      searchQuery: '',
      searchHistory: [],
      setSearchQuery: (q) => set({ searchQuery: q }),
      addSearchHistory: (q) => set((state) => ({
        searchHistory: [q, ...state.searchHistory.filter(s => s !== q)].slice(0, 10)
      })),
      clearSearchHistory: () => set({ searchHistory: [] }),

      // Profile
      avatarUrl: null,
      updateAvatar: (url) => set({ avatarUrl: url }),
      updateProfile: (data) => set((state) => ({
        currentUser: state.currentUser
          ? { ...state.currentUser, ...data }
          : null
      })),

      // Seller Financial - START AT 0
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

      // Products - START EMPTY (fetched from API)
      products: [],
      addProduct: (product) => set((state) => ({
        products: [product, ...state.products]
      })),
      updateProduct: (product) => set((state) => ({
        products: state.products.map(p => p.id === product.id ? product : p)
      })),
      removeProduct: (id) => set((state) => ({
        products: state.products.filter(p => p.id !== id)
      })),

      // Reviews - START EMPTY
      reviews: [],
      reviewedOrderIds: [],
      addReview: (review, orderId) => {
        // Call the API to persist the review
        fetch('/api/reviews', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            productId: review.productId,
            rating: review.rating,
            content: review.content,
            images: review.images,
          }),
        }).catch((error) => {
          console.error('Create review API error:', error)
        })

        // Also update local state for immediate UI feedback
        return set((state) => {
          const updatedProducts = state.products.map(p => {
            if (p.id !== review.productId) return p
            const productReviews = [...state.reviews.filter(r => r.productId === p.id), review]
            const avgRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
            return { ...p, rating: Math.round(avgRating * 10) / 10, reviewCount: p.reviewCount + 1 }
          })
          return {
            reviews: [review, ...state.reviews],
            reviewedOrderIds: [...state.reviewedOrderIds, orderId],
            products: updatedProducts,
          }
        })
      },
      deleteReview: (reviewId) => set((state) => {
        const review = state.reviews.find(r => r.id === reviewId)
        if (!review) return state

        const remainingReviews = state.reviews.filter(r => r.id !== reviewId)
        const updatedProducts = state.products.map(p => {
          if (p.id !== review.productId) return p
          const productReviews = remainingReviews.filter(r => r.productId === p.id)
          const avgRating = productReviews.length > 0
            ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
            : 0
          return {
            ...p,
            rating: Math.round(avgRating * 10) / 10,
            reviewCount: Math.max(0, p.reviewCount - 1),
          }
        })

        return {
          reviews: state.reviews.filter(r => r.id !== reviewId),
          products: updatedProducts,
        }
      }),
      updateReview: (reviewId, updates) => set((state) => {
        const review = state.reviews.find(r => r.id === reviewId)
        if (!review) return state

        const updatedReviews = state.reviews.map(r =>
          r.id === reviewId ? { ...r, ...updates } : r
        )

        const productId = review.productId
        const updatedProducts = state.products.map(p => {
          if (p.id !== productId) return p
          const productReviews = updatedReviews.filter(r => r.productId === p.id)
          const avgRating = productReviews.length > 0
            ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
            : 0
          return { ...p, rating: Math.round(avgRating * 10) / 10 }
        })

        return {
          reviews: updatedReviews,
          products: updatedProducts,
        }
      }),
      fetchProductReviews: async (productId) => {
        try {
          const res = await fetch(`/api/reviews?productId=${productId}`)
          if (!res.ok) throw new Error('Failed to fetch product reviews')
          const data = await res.json()
          if (data.success && data.data) {
            const reviews: Review[] = (data.data as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => {
              const user = r.user as Record<string, unknown> | undefined
              return {
                id: r.id as string,
                userId: r.userId as string,
                productId: r.productId as string,
                rating: r.rating as number,
                content: r.content as string || undefined,
                images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images as string[]) || undefined,
                userName: (user?.name as string) || 'User',
                userAvatar: (user?.avatar as string) || undefined,
                createdAt: r.createdAt as string,
              }
            })
            set((state) => {
              // Replace reviews for this product, keep others
              const otherReviews = state.reviews.filter(r => r.productId !== productId)
              return { reviews: [...reviews, ...otherReviews] }
            })
          }
        } catch (error) {
          console.error('Fetch product reviews error:', error)
        }
      },

      // Admin Users - START EMPTY
      adminUsers: [],
      updateAdminUser: (userId, updates) => set((state) => ({
        adminUsers: state.adminUsers.map(u => u.id === userId ? { ...u, ...updates } : u)
      })),
      deleteAdminUser: (userId) => set((state) => ({
        adminUsers: state.adminUsers.filter(u => u.id !== userId)
      })),

      // Admin Banners - START EMPTY
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

      // Admin Complaints - START EMPTY
      adminComplaints: [],
      updateAdminComplaint: (complaintId, updates) => set((state) => ({
        adminComplaints: state.adminComplaints.map(c => c.id === complaintId ? { ...c, ...updates } : c)
      })),

      // Admin Divisions - START EMPTY
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
            headers: getAuthHeaders(),
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
            headers: getAuthHeaders(),
            body: JSON.stringify({ divisionId, updates }),
          })
          if (!res.ok) throw new Error('Failed to update division')
          // Refresh divisions
          get().fetchDivisions()
        } catch (error) {
          console.error('Update division error:', error)
        }
      },

      // Settings
      settings: {
        twoFactor: false,
        pushNotif: true,
        emailNotif: true,
        dataSharing: false,
      },
      updateSettings: (settings) => set((state) => ({
        settings: { ...state.settings, ...settings }
      })),

      // Account
      deleteAccount: async () => {
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
          sellerBalance: { availableBalance: 0, pendingBalance: 0, holdBalance: 0, totalBalance: 0, totalWithdrawn: 0 },
          sellerBankAccounts: [],
          withdrawRequests: [],
          adminUsers: [],
          adminBanners: [],
          adminComplaints: [],
          adminStats: null,
          divisions: [],
          chatRooms: [],
          chatMessages: {},
          totalUnreadChats: 0,
          selectedVoucher: null,
          usedVoucherIds: [],
          vouchers: [],
          searchQuery: '',
          homeBanners: [],
        })
      },

      // Admin Data Fetching
      adminStats: null,

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

      // Data fetching
      seller: null,
      sellerStats: null,
      isDataLoaded: false,
      categories: [],

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

      fetchUserData: async (userId: string) => {
        try {
          const res = await fetch(`/api/user-data?userId=${userId}`, { headers: getAuthHeaders() })
          if (!res.ok) throw new Error('Failed to fetch user data')
          const raw = await res.json()
          const data = raw.data || raw  // Unwrap { success, data } response

          const state = get()

          // Update user
          if (data.user) {
            const user: User = {
              id: data.user.id,
              email: data.user.email,
              phone: data.user.phone || undefined,
              name: data.user.name,
              avatar: data.user.avatar || undefined,
              role: (data.user.role as UserRole) || 'buyer',
              isVerified: data.user.isVerified,
              loyaltyPoints: data.user.loyaltyPoints || 0,
              coins: data.user.coins || 0,
              referralCode: data.user.referralCode || undefined,
            }
            set({
              currentUser: user,
              userRole: user.role,
              isAuthenticated: true,
            })
          }

          // Update seller
          if (data.seller) {
            const seller: Seller = {
              id: data.seller.id,
              userId: data.seller.userId,
              storeName: data.seller.storeName,
              storeSlug: data.seller.storeSlug,
              storeDesc: data.seller.storeDesc || undefined,
              storeAvatar: data.seller.storeAvatar || undefined,
              storeBanner: data.seller.storeBanner || undefined,
              isVerified: data.seller.isVerified,
              isPremium: data.seller.isPremium,
              rating: data.seller.rating,
              totalSales: data.seller.totalSales,
              totalProducts: data.seller.totalProducts,
              responseTime: data.seller.responseTime || undefined,
              bankName: data.seller.bankName || undefined,
              bankAccount: data.seller.bankAccount || undefined,
              bankHolder: data.seller.bankHolder || undefined,
              autoReply: data.seller.autoReply || undefined,
            }
            set({ seller })

            // Update seller balance from seller wallet
            if (data.seller.wallet) {
              const walletBal = data.seller.wallet.balance || 0
              const walletHold = data.seller.wallet.holdBalance || 0
              const walletPending = data.seller.wallet.pendingBalance || 0
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

          // Update wallet
          if (data.wallet) {
            set({
              walletBalance: data.wallet.balance || 0,
              walletHoldBalance: data.wallet.holdBalance || 0,
              walletMutations: (data.wallet.mutations || []).map((m: any) => ({
                id: m.id,
                type: m.type,
                amount: m.amount,
                balance: m.balance,
                description: m.description,
                refType: m.refType || undefined,
                createdAt: m.createdAt,
              })),
            })
          }

          // Update orders
          if (data.orders) {
            set({
              orders: data.orders.map((o: any) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                userId: o.userId,
                sellerId: o.sellerId,
                status: o.status as OrderStatus,
                subtotal: o.subtotal,
                shippingCost: o.shippingCost,
                discountAmount: o.discountAmount || 0,
                taxAmount: o.taxAmount || 0,
                platformFee: o.platformFee || 0,
                totalAmount: o.totalAmount,
                paymentMethod: o.paymentMethod || undefined,
                paymentStatus: o.paymentStatus,
                items: (o.items || []).map((item: any) => ({
                  id: item.id,
                  productId: item.productId,
                  productName: item.productName,
                  variantName: item.variantName || undefined,
                  variantId: item.variantId || undefined,
                  price: item.price,
                  quantity: item.quantity,
                  subtotal: item.subtotal,
                  image: item.image || (item.product?.images?.[0]) || undefined,
                })),
                shipping: o.shipping ? {
                  id: o.shipping.id,
                  provider: o.shipping.provider,
                  service: o.shipping.service,
                  trackingNumber: o.shipping.trackingNumber || undefined,
                  estimatedDays: o.shipping.estimatedDays || undefined,
                  status: o.shipping.status,
                } : undefined,
                address: o.addressId ? {
                  id: o.addressId,
                  label: '',
                  recipient: '',
                  phone: '',
                  address: '',
                  city: '',
                  province: '',
                  postalCode: '',
                  isDefault: false,
                } : {
                  id: 'default',
                  label: 'Alamat',
                  recipient: state.currentUser?.name || '',
                  phone: state.currentUser?.phone || '',
                  address: 'Alamat pengiriman',
                  city: '',
                  province: '',
                  postalCode: '',
                  isDefault: true,
                },
                seller: o.seller ? {
                  id: o.seller.id,
                  userId: o.seller.userId || '',
                  storeName: o.seller.storeName || 'Unknown Store',
                  storeSlug: o.seller.storeSlug || '',
                  storeAvatar: o.seller.storeAvatar || undefined,
                  isVerified: o.seller.isVerified || false,
                  isPremium: o.seller.isPremium || false,
                  rating: o.seller.rating || 0,
                  totalSales: o.seller.totalSales || 0,
                  totalProducts: o.seller.totalProducts || 0,
                } : {
                  id: '',
                  userId: '',
                  storeName: 'Unknown Seller',
                  storeSlug: '',
                  isVerified: false,
                  isPremium: false,
                  rating: 0,
                  totalSales: 0,
                  totalProducts: 0,
                },
                createdAt: o.createdAt,
                paidAt: o.paidAt || undefined,
                shippedAt: o.shippedAt || undefined,
                deliveredAt: o.deliveredAt || undefined,
              })),
            })
          }

          // Update notifications
          if (data.notifications) {
            set({
              notifications: data.notifications.map((n: any) => ({
                id: n.id,
                title: n.title,
                content: n.content,
                type: n.type as AppNotification['type'],
                isRead: n.isRead,
                createdAt: n.createdAt,
              })),
              unreadNotificationCount: data.unreadNotificationCount || 0,
            })
          }

          // Update addresses
          if (data.addresses) {
            set({
              addresses: data.addresses.map((a: any) => ({
                id: a.id,
                label: a.label,
                recipient: a.recipient,
                phone: a.phone,
                address: a.address,
                city: a.city,
                province: a.province,
                postalCode: a.postalCode,
                isDefault: a.isDefault,
              })),
              selectedAddressId: data.addresses.find((a: any) => a.isDefault)?.id || data.addresses[0]?.id || null,
            })
          }

          // Update reviews
          if (data.reviews) {
            set({
              reviews: data.reviews.map((r: any) => ({
                id: r.id,
                userId: r.userId,
                productId: r.productId,
                rating: r.rating,
                content: r.content || undefined,
                images: r.images ? (typeof r.images === 'string' ? JSON.parse(r.images) : r.images) : [],
                userName: r.user?.name || 'Anonymous',
                userAvatar: r.user?.avatar || undefined,
                createdAt: r.createdAt,
              })),
            })
          }

          // Update wishlist
          if (data.wishlistProductIds && data.wishlistProductIds.length > 0) {
            const { wishlistIds } = useWishlistStore.getState()
            const mergedIds = [...new Set([...wishlistIds, ...data.wishlistProductIds])]
            useWishlistStore.setState({ wishlistIds: mergedIds })
          }

          set({ isDataLoaded: true })
        } catch (error) {
          console.error('Failed to fetch user data:', error)
        }
      },

      fetchProducts: async () => {
        try {
          const res = await fetch('/api/products?limit=100')
          if (!res.ok) throw new Error('Failed to fetch products')
          const data = await res.json()

          const products: Product[] = (data.data || data.products || []).map((p: any) => ({
            id: p.id,
            sellerId: p.sellerId,
            categoryId: p.categoryId,
            name: p.name,
            slug: p.slug,
            description: p.description,
            price: p.price,
            discountPrice: p.discountPrice || undefined,
            images: Array.isArray(p.images) ? p.images : (typeof p.images === 'string' ? JSON.parse(p.images) : []),
            stock: p.stock,
            sold: p.sold,
            minOrder: p.minOrder || 1,
            weight: p.weight,
            condition: (p.condition as 'new' | 'used') || 'new',
            status: p.status as 'active' | 'draft' | 'blocked',
            rating: p.rating,
            reviewCount: p.reviewCount,
            isFeatured: p.isFeatured,
            isFlashSale: p.isFlashSale,
            flashSaleEnd: p.flashSaleEnd || undefined,
            tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags) : undefined),
            variants: (p.variants || []).map((v: any) => ({
              id: v.id,
              productId: v.productId,
              name: v.name,
              value: v.value,
              sku: v.sku || undefined,
              price: v.price || undefined,
              stock: v.stock,
              image: v.image || undefined,
            })),
            seller: p.seller ? {
              id: p.seller.id,
              userId: p.seller.userId,
              storeName: p.seller.storeName,
              storeSlug: p.seller.storeSlug,
              storeAvatar: p.seller.storeAvatar || undefined,
              storeDesc: p.seller.storeDesc || undefined,
              isVerified: p.seller.isVerified,
              isPremium: p.seller.isPremium,
              rating: p.seller.rating,
              totalSales: p.seller.totalSales,
              totalProducts: p.seller.totalProducts,
              responseTime: p.seller.responseTime || undefined,
              bankName: p.seller.bankName || undefined,
              bankAccount: p.seller.bankAccount || undefined,
              bankHolder: p.seller.bankHolder || undefined,
              autoReply: p.seller.autoReply || undefined,
            } : {
              id: '',
              userId: '',
              storeName: 'Unknown Seller',
              storeSlug: '',
              isVerified: false,
              isPremium: false,
              rating: 0,
              totalSales: 0,
              totalProducts: 0,
            },
            category: p.category ? {
              id: p.category.id,
              name: p.category.name,
              slug: p.category.slug,
              icon: p.category.icon || undefined,
              image: p.category.image || undefined,
            } : {
              id: '',
              name: 'Uncategorized',
              slug: 'uncategorized',
            },
          }))

          set({ products })
        } catch (error) {
          console.error('Failed to fetch products:', error)
        }
      },

      fetchCategories: async () => {
        try {
          const res = await fetch('/api/categories')
          if (!res.ok) throw new Error('Failed to fetch categories')
          const data = await res.json()

          const mapCategory = (c: any): any => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            icon: c.icon || undefined,
            image: c.image || undefined,
            parentId: c.parentId || null,
            productCount: c.productCount || c._count?.products || 0,
            children: (c.children || []).map(mapCategory),
          })

          set({ categories: (data.data || data.categories || []).map(mapCategory) })
        } catch (error) {
          console.error('Failed to fetch categories:', error)
        }
      },

      // Home Banners
      homeBanners: [],
      fetchHomeBanners: async () => {
        try {
          const res = await fetch('/api/banners?position=home_top')
          if (!res.ok) throw new Error('Failed to fetch banners')
          const data = await res.json()
          if (data.success && data.data) {
            set({
              homeBanners: data.data.map((b: any) => ({
                id: b.id,
                title: b.title,
                image: b.image,
                link: b.link || '',
                position: b.position,
              }))
            })
          }
        } catch (error) {
          console.error('Failed to fetch home banners:', error)
        }
      },
    }),
    {
      name: 'martup-storage',
      version: 2, // Bumped to clear stale localStorage data from mock-data era
      partialize: (state) => ({
        // Only persist non-sensitive UI preferences
        // Do NOT persist currentScreen — it can reference protected screens (seller-dashboard, admin-dashboard)
        // which cause crashes on reload when auth state is not yet restored
        previousScreens: [],
        settings: state.settings,
        searchHistory: state.searchHistory,
        // Do NOT persist: currentScreen, orders, notifications, products, wallet, vouchers, etc.
        // These should always come from the API for consistency
      }),
    }
  )
)

// ==================== CART STORE ====================
interface CartState {
  items: CartItem[]
  addItem: (product: Product, variant?: ProductVariant, quantity?: number) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  toggleCheck: (id: string) => void
  checkAll: (checked: boolean) => void
  clearCart: () => void
  getTotalPrice: () => number
  getCheckedTotalPrice: () => number
  getTotalItemCount: () => number
  getCheckedItemCount: () => number
  getCheckedItems: () => CartItem[]
  getCheckedTotal: () => number
  getCheckedCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, variant, quantity = 1) => set((state) => {
        const variantId = variant?.id
        const existing = state.items.find(
          (i) => i.productId === product.id && i.variantId === variantId
        )
        if (existing) {
          return {
            items: state.items.map((i) =>
              i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i
            ),
          }
        }
        return {
          items: [...state.items, {
            id: `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            productId: product.id,
            variantId: variantId || undefined,
            quantity,
            isChecked: true,
            product,
            variant: variant || undefined,
          }]
        }
      }),
      removeItem: (id) => set((state) => ({
        items: state.items.filter((i) => i.id !== id),
      })),
      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, quantity } : i
        ),
      })),
      toggleCheck: (id) => set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, isChecked: !i.isChecked } : i
        ),
      })),
      checkAll: (checked) => set((state) => ({
        items: state.items.map((i) => ({ ...i, isChecked: checked })),
      })),
      clearCart: () => set({ items: [] }),
      getTotalPrice: () =>
        get().items.reduce((sum, item) => {
          const basePrice = item.variant?.price || item.product.discountPrice || item.product.price
          return sum + basePrice * item.quantity
        }, 0),
      getCheckedTotalPrice: () =>
        get()
          .items.filter((i) => i.isChecked)
          .reduce((sum, item) => {
            const basePrice = item.variant?.price || item.product.discountPrice || item.product.price
            return sum + basePrice * item.quantity
          }, 0),
      getTotalItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      getCheckedItemCount: () =>
        get().items.filter((i) => i.isChecked).reduce((sum, item) => sum + item.quantity, 0),
      getCheckedItems: () => get().items.filter((i) => i.isChecked),
      getCheckedTotal: () =>
        get().items.filter((i) => i.isChecked)
          .reduce((sum, item) => {
            const basePrice = item.variant?.price || item.product.discountPrice || item.product.price
            return sum + basePrice * item.quantity
          }, 0),
      getCheckedCount: () =>
        get().items.filter((i) => i.isChecked).reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: 'martup-cart',
    }
  )
)

// ==================== WISHLIST STORE ====================
interface WishlistState {
  wishlistIds: string[]
  toggleWishlist: (productId: string) => void
  isWishlisted: (productId: string) => boolean
  syncWishlistFromServer: (userId: string) => Promise<void>
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlistIds: [],
      toggleWishlist: (productId) => {
        const isCurrentlyWishlisted = get().wishlistIds.includes(productId)

        // Optimistic local update
        set((state) => ({
          wishlistIds: isCurrentlyWishlisted
            ? state.wishlistIds.filter((id) => id !== productId)
            : [...state.wishlistIds, productId],
        }))

        // Call API to persist
        if (isCurrentlyWishlisted) {
          fetch('/api/wishlist', {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify({ productId }),
          }).catch((error) => {
            console.error('Remove from wishlist API error:', error)
            // Revert on error
            set((state) => ({ wishlistIds: [...state.wishlistIds, productId] }))
          })
        } else {
          fetch('/api/wishlist', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ productId }),
          }).catch((error) => {
            console.error('Add to wishlist API error:', error)
            // Revert on error
            set((state) => ({ wishlistIds: state.wishlistIds.filter((id) => id !== productId) }))
          })
        }
      },
      isWishlisted: (productId) => get().wishlistIds.includes(productId),
      syncWishlistFromServer: async (userId) => {
        try {
          const res = await fetch(`/api/wishlist?userId=${userId}`, { headers: getAuthHeaders() })
          if (!res.ok) throw new Error('Failed to fetch wishlist')
          const data = await res.json()
          if (data.success && data.data) {
            const ids = (data.data as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => {
              const product = item.product as Record<string, unknown> | undefined
              return (item.productId as string) || (product?.id as string) || ''
            }).filter(Boolean)
            set({ wishlistIds: ids })
          }
        } catch (error) {
          console.error('Sync wishlist from server error:', error)
        }
      },
    }),
    {
      name: 'martup-wishlist',
    }
  )
)
