import type { ScreenName, UserRole, User, CartItem, Product, ProductVariant, Notification as AppNotification, ChatRoom, ChatMessage, Address, Voucher, Order, OrderStatus, WalletMutation, BankAccount, WithdrawRequest, WithdrawStatus, SellerBalance, Review, Seller, Division, SellerStats, AdminStats } from '../types'

// ==================== SLICE INTERFACES ====================

export interface NavigationSlice {
  currentScreen: ScreenName
  previousScreens: ScreenName[]
  otpPhoneNumber: string
  pendingVerificationEmail: string
  resetPasswordToken: string
  navigate: (screen: ScreenName) => void
  goBack: () => void
}

export interface AuthSlice {
  isAuthenticated: boolean
  currentUser: User | null
  userRole: UserRole
  originalRole: UserRole // The actual DB role — never mutated by switchRole
  isSuperAdminUser: boolean // Whether the current user is a Super Admin (role='admin' + specific email)
  login: (user: User & { isSuperAdmin?: boolean }) => void
  logout: () => Promise<void>
  switchRole: (role: UserRole) => Promise<void>
  deleteAccount: () => void
}

export interface SelectionSlice {
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
}

export interface UISlice {
  isLoading: boolean
  showSplash: boolean
  setShowSplash: (v: boolean) => void
  toast: { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  hideToast: () => void
}

export interface NotificationSlice {
  notifications: AppNotification[]
  unreadNotificationCount: number
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  fetchNotifications: (userId: string) => Promise<void>
}

export interface ChatSlice {
  chatRooms: ChatRoom[]
  chatMessages: Record<string, ChatMessage[]>
  totalUnreadChats: number
  isSocketConnected: boolean
  typingUsers: Record<string, string[]>  // roomId → userIds currently typing
  addChatMessage: (roomId: string, message: ChatMessage) => void
  addChatRoom: (room: ChatRoom) => void
  markChatRead: (roomId: string) => void
  fetchChatRooms: () => Promise<void>
  fetchChatMessages: (roomId: string) => Promise<void>
  sendChatMessage: (roomId: string, content: string, type?: string) => Promise<void>
  createChatRoom: (sellerId: string, productId?: string) => Promise<string | null>
  connectSocket: () => void
  disconnectSocket: () => void
  emitTyping: (roomId: string, isTyping: boolean) => void
}

export interface OrderSlice {
  orders: Order[]
  isOrdersLoaded: boolean
  addOrder: (order: Order) => void
  updateOrderStatus: (orderId: string, status: OrderStatus, options?: { trackingNumber?: string; cancelReason?: string }) => Promise<void>
  payForOrder: (orderId: string) => Promise<{ token?: string; redirectUrl?: string } | void>
  cancelOrder: (orderId: string) => Promise<void>
  updateOrderTracking: (orderId: string, trackingNumber: string) => Promise<void>
  fetchOrders: (userId: string) => Promise<void>
}

export interface AddressSlice {
  addresses: Address[]
  selectedAddressId: string | null
  addAddress: (address: Omit<Address, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateAddress: (address: Address) => Promise<void>
  deleteAddress: (id: string) => Promise<void>
  setDefaultAddress: (id: string) => Promise<void>
  fetchAddresses: (userId: string) => Promise<void>
}

export interface WalletSlice {
  walletBalance: number
  walletHoldBalance: number
  walletCoins: number
  walletMutations: WalletMutation[]
  isWalletLoaded: boolean
  topUpWallet: (amount: number, method?: string) => Promise<void>
  withdrawWallet: (amount: number, bankAccount: string, bankDetails?: { bankAccount: string; bankName: string; bankHolder: string }) => Promise<void>
  deductWallet: (amount: number, description: string) => void
  fetchWalletBalance: (userId: string) => Promise<void>
  fetchWalletMutations: (userId: string) => Promise<void>
}

export interface VoucherSlice {
  vouchers: Voucher[]
  selectedVoucher: Voucher | null
  selectVoucher: (voucher: Voucher | null) => void
  usedVoucherIds: string[]
  useVoucher: (voucherId: string) => void
}

export interface FollowedStoresSlice {
  followedStoreIds: string[]
  followedStoresData: Array<{
    id: string
    storeName: string
    storeSlug: string
    storeAvatar: string
    isVerified: boolean
    isPremium: boolean
    rating: number
    totalProducts: number
    totalSales: number
  }>
  toggleFollowStore: (storeId: string) => Promise<void>
  isFollowingStore: (storeId: string) => boolean
  fetchFollowedStores: (userId: string) => Promise<void>
}

export interface SearchSlice {
  searchQuery: string
  searchHistory: string[]
  setSearchQuery: (q: string) => void
  addSearchHistory: (q: string) => void
  clearSearchHistory: () => void
}

export interface ProfileSlice {
  avatarUrl: string | null
  updateAvatar: (url: string | null) => void
  updateProfile: (data: { name?: string; email?: string; phone?: string }) => void
  uploadAvatar: (file: File) => Promise<void>
  removeAvatar: () => Promise<void>
}

export interface SellerSlice {
  sellerBalance: SellerBalance
  sellerBankAccounts: BankAccount[]
  withdrawRequests: WithdrawRequest[]
  commissionRate: number
  addBankAccount: (account: BankAccount) => void
  removeBankAccount: (id: string) => void
  setDefaultBankAccount: (id: string) => void
  requestWithdraw: (amount: number, bankAccountId: string) => void
  updateWithdrawStatus: (id: string, status: WithdrawStatus, rejectionReason?: string) => void
  getSellerAvailableForWithdraw: () => number
  seller: Seller | null
  sellerStats: SellerStats | null
  fetchSellerStats: () => Promise<void>
  fetchWithdrawHistory: (sellerId: string) => Promise<void>
}

export interface ProductSlice {
  products: Product[]
  addProduct: (product: Product) => void
  updateProduct: (product: Product) => void
  removeProduct: (id: string) => void
  categories: Array<{
    id: string
    name: string
    slug: string
    icon?: string
    image?: string
    parentId?: string | null
    productCount?: number
    children?: Array<{
      id: string
      name: string
      slug: string
      icon?: string
      parentId?: string | null
      productCount?: number
    }>
  }>
  fetchProducts: () => Promise<void>
  fetchCategories: () => Promise<void>
}

export interface ReviewSlice {
  reviews: Review[]
  reviewedOrderIds: string[]
  addReview: (review: Review, orderId: string, orderItemId?: string) => void
  deleteReview: (reviewId: string) => void
  updateReview: (reviewId: string, updates: Partial<Review>) => void
  fetchProductReviews: (productId: string) => Promise<void>
}

export interface AdminSlice {
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
  updateAdminUser: (userId: string, updates: Record<string, unknown>) => void
  deleteAdminUser: (userId: string) => void
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
  addAdminBanner: (banner: {
    id: string; title: string; image: string; link: string;
    position: string; isActive: boolean; sortOrder: number;
    startDate?: string | null; endDate?: string | null;
  }) => void
  updateAdminBanner: (bannerId: string, updates: Record<string, unknown>) => void
  deleteAdminBanner: (bannerId: string) => void
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
  updateAdminComplaint: (complaintId: string, updates: Record<string, unknown>) => void
  divisions: Division[]
  fetchDivisions: () => Promise<void>
  fetchAdminUsers: () => Promise<void>
  assignUserToDivision: (userId: string, divisionId: string | null) => Promise<void>
  updateDivision: (divisionId: string, updates: Record<string, unknown>) => Promise<void>
  adminStats: AdminStats | null
  fetchAdminStats: () => Promise<void>
  adminOrders: Order[]
  fetchAdminOrders: () => Promise<void>
  fetchAdminWithdrawals: () => Promise<void>
  fetchAdminBanners: () => Promise<void>
  fetchAdminComplaints: () => Promise<void>
  platformSettings: Record<string, number | boolean | string> | null
  fetchPlatformSettings: () => Promise<void>
}

export interface SettingsSlice {
  settings: {
    twoFactor: boolean
    pushNotif: boolean
    emailNotif: boolean
    dataSharing: boolean
  }
  isSettingsLoaded: boolean
  updateSettings: (settings: Partial<SettingsSlice['settings']>) => void
  fetchSettings: () => Promise<void>
}

export interface DataFetchSlice {
  isDataLoaded: boolean
  fetchUserData: (userId: string) => Promise<void>
  fetchHomeBanners: () => Promise<void>
  homeBanners: Array<{ id: string; title: string; image: string; link?: string; position: string }>
}

// ==================== COMBINED STORE TYPE ====================

export type AppStore = NavigationSlice &
  AuthSlice &
  SelectionSlice &
  UISlice &
  NotificationSlice &
  ChatSlice &
  OrderSlice &
  AddressSlice &
  WalletSlice &
  VoucherSlice &
  FollowedStoresSlice &
  SearchSlice &
  ProfileSlice &
  SellerSlice &
  ProductSlice &
  ReviewSlice &
  AdminSlice &
  SettingsSlice &
  DataFetchSlice
