import { create } from 'zustand'
import type { ScreenName, UserRole, User, CartItem, Product, ProductVariant, Notification as AppNotification, ChatRoom, Address, Voucher, Order, WalletMutation, SellerStats, AdminStats } from './types'

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
  logout: () => void
  switchRole: (role: UserRole) => void

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

  // Notifications
  notifications: AppNotification[]
  unreadNotificationCount: number
  markNotificationRead: (id: string) => void

  // Chat
  chatRooms: ChatRoom[]
  totalUnreadChats: number

  // Orders
  orders: Order[]

  // Address
  addresses: Address[]
  selectedAddressId: string | null

  // Wallet mutations
  walletMutations: WalletMutation[]

  // Vouchers
  vouchers: Voucher[]
  selectedVoucher: Voucher | null

  // Search
  searchQuery: string
  searchHistory: string[]
  setSearchQuery: (q: string) => void
  addSearchHistory: (q: string) => void
  clearSearchHistory: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
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
  logout: () => set({
    isAuthenticated: false,
    currentUser: null,
    userRole: 'buyer',
    currentScreen: 'login'
  }),
  switchRole: (role) => set((state) => ({
    userRole: role,
    currentUser: state.currentUser ? { ...state.currentUser, role } : null,
    currentScreen: role === 'buyer' ? 'home' : role === 'seller' ? 'seller-dashboard' : 'admin-dashboard'
  })),

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

  // Notifications
  notifications: [
    { id: '1', title: 'Pesanan Dikirim', content: 'Pesanan #ORD-2024-001 telah dikirim via JNE REG', type: 'order', isRead: false, createdAt: '2024-12-20T10:00:00Z' },
    { id: '2', title: 'Flash Sale Dimulai!', content: 'Diskon hingga 70% untuk produk pilihan', type: 'promo', isRead: false, createdAt: '2024-12-20T09:00:00Z' },
    { id: '3', title: 'Pembayaran Berhasil', content: 'Pembayaran sebesar Rp 250.000 berhasil', type: 'order', isRead: true, createdAt: '2024-12-19T15:00:00Z' },
    { id: '4', title: 'Pesan Baru', content: 'Toko Gadget Pro mengirim pesan', type: 'chat', isRead: false, createdAt: '2024-12-19T12:00:00Z' },
    { id: '5', title: 'Voucher Baru', content: 'Kamu mendapat voucher gratis ongkir!', type: 'promo', isRead: true, createdAt: '2024-12-18T08:00:00Z' },
  ],
  unreadNotificationCount: 3,
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
    unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1)
  })),

  // Chat
  chatRooms: [
    { id: '1', seller: { id: 's1', userId: 'u2', storeName: 'Gadget Pro Store', storeSlug: 'gadget-pro', storeAvatar: '', isVerified: true, isPremium: true, rating: 4.9, totalSales: 15000, totalProducts: 250 }, lastMessage: 'Terima kasih sudah order kak! 🙏', lastMessageTime: '2024-12-20T10:30:00Z', unreadCount: 2 },
    { id: '2', seller: { id: 's2', userId: 'u3', storeName: 'Fashion Hub', storeSlug: 'fashion-hub', storeAvatar: '', isVerified: true, isPremium: false, rating: 4.7, totalSales: 8000, totalProducts: 120 }, lastMessage: 'Barang ready kak, silakan order', lastMessageTime: '2024-12-20T09:15:00Z', unreadCount: 0 },
    { id: '3', seller: { id: 's3', userId: 'u4', storeName: 'Beauty Corner', storeSlug: 'beauty-corner', storeAvatar: '', isVerified: false, isPremium: false, rating: 4.5, totalSales: 3000, totalProducts: 80 }, lastMessage: 'Bisa restock minggu depan ya kak', lastMessageTime: '2024-12-19T16:00:00Z', unreadCount: 1 },
  ],
  totalUnreadChats: 3,

  // Orders
  orders: [
    {
      id: '1', orderNumber: 'ORD-2024-001', userId: 'u1', sellerId: 's1',
      status: 'shipped', subtotal: 450000, shippingCost: 15000, discountAmount: 20000,
      taxAmount: 0, platformFee: 1000, totalAmount: 446000, paymentMethod: 'Midtrans',
      paymentStatus: 'paid',
      items: [{ id: 'oi1', productId: '1', productName: 'iPhone 15 Pro Max 256GB', price: 450000, quantity: 1, subtotal: 450000, image: '' }],
      shipping: { id: 'sh1', provider: 'JNE', service: 'REG', trackingNumber: 'JNE1234567890', estimatedDays: '2-3', status: 'in_transit' },
      address: { id: 'a1', label: 'Rumah', recipient: 'Ahmad', phone: '08123456789', address: 'Jl. Merdeka No. 10', city: 'Jakarta Selatan', province: 'DKI Jakarta', postalCode: '12345', isDefault: true },
      seller: { id: 's1', userId: 'u2', storeName: 'Gadget Pro Store', storeSlug: 'gadget-pro', storeAvatar: '', isVerified: true, isPremium: true, rating: 4.9, totalSales: 15000, totalProducts: 250 },
      createdAt: '2024-12-18T10:00:00Z', paidAt: '2024-12-18T10:05:00Z', shippedAt: '2024-12-19T08:00:00Z'
    },
    {
      id: '2', orderNumber: 'ORD-2024-002', userId: 'u1', sellerId: 's2',
      status: 'delivered', subtotal: 189000, shippingCost: 10000, discountAmount: 0,
      taxAmount: 0, platformFee: 1000, totalAmount: 200000, paymentMethod: 'Wallet',
      paymentStatus: 'paid',
      items: [{ id: 'oi2', productId: '3', productName: 'Kemeja Flannel Premium', price: 189000, quantity: 1, subtotal: 189000, image: '' }],
      shipping: { id: 'sh2', provider: 'SiCepat', service: 'REG', trackingNumber: 'SI1234567890', estimatedDays: '1-2', status: 'delivered' },
      address: { id: 'a1', label: 'Rumah', recipient: 'Ahmad', phone: '08123456789', address: 'Jl. Merdeka No. 10', city: 'Jakarta Selatan', province: 'DKI Jakarta', postalCode: '12345', isDefault: true },
      seller: { id: 's2', userId: 'u3', storeName: 'Fashion Hub', storeSlug: 'fashion-hub', storeAvatar: '', isVerified: true, isPremium: false, rating: 4.7, totalSales: 8000, totalProducts: 120 },
      createdAt: '2024-12-15T14:00:00Z', paidAt: '2024-12-15T14:05:00Z', shippedAt: '2024-12-16T09:00:00Z', deliveredAt: '2024-12-17T11:00:00Z'
    },
    {
      id: '3', orderNumber: 'ORD-2024-003', userId: 'u1', sellerId: 's3',
      status: 'pending', subtotal: 75000, shippingCost: 9000, discountAmount: 5000,
      taxAmount: 0, platformFee: 1000, totalAmount: 80000, paymentMethod: 'COD',
      paymentStatus: 'unpaid',
      items: [{ id: 'oi3', productId: '7', productName: 'Lipstik Matte Velvet', price: 75000, quantity: 1, subtotal: 75000, image: '' }],
      shipping: { id: 'sh3', provider: 'J&T', service: 'EZ', estimatedDays: '2-4', status: 'pending' },
      address: { id: 'a1', label: 'Rumah', recipient: 'Ahmad', phone: '08123456789', address: 'Jl. Merdeka No. 10', city: 'Jakarta Selatan', province: 'DKI Jakarta', postalCode: '12345', isDefault: true },
      seller: { id: 's3', userId: 'u4', storeName: 'Beauty Corner', storeSlug: 'beauty-corner', storeAvatar: '', isVerified: false, isPremium: false, rating: 4.5, totalSales: 3000, totalProducts: 80 },
      createdAt: '2024-12-20T08:00:00Z'
    }
  ],

  // Address
  addresses: [
    { id: 'a1', label: 'Rumah', recipient: 'Ahmad Fauzi', phone: '08123456789', address: 'Jl. Merdeka No. 10, Kel. Menteng', city: 'Jakarta Selatan', province: 'DKI Jakarta', postalCode: '10310', isDefault: true },
    { id: 'a2', label: 'Kantor', recipient: 'Ahmad Fauzi', phone: '08123456789', address: 'Jl. Sudirman Kav. 52-53, Senayan', city: 'Jakarta Pusat', province: 'DKI Jakarta', postalCode: '12190', isDefault: false },
  ],
  selectedAddressId: 'a1',

  // Wallet mutations
  walletMutations: [
    { id: 'wm1', type: 'credit', amount: 500000, balance: 1500000, description: 'Top up via GoPay', refType: 'deposit', createdAt: '2024-12-20T10:00:00Z' },
    { id: 'wm2', type: 'debit', amount: 200000, description: 'Pembayaran Order #ORD-2024-002', refType: 'order', balance: 1000000, createdAt: '2024-12-15T14:05:00Z' },
    { id: 'wm3', type: 'credit', amount: 10000, balance: 1200000, description: 'Cashback pembelian', refType: 'cashback', createdAt: '2024-12-17T11:00:00Z' },
    { id: 'wm4', type: 'debit', amount: 50000, balance: 1190000, description: 'Pembayaran Order #ORD-2024-003', refType: 'order', createdAt: '2024-12-20T08:00:00Z' },
  ],

  // Vouchers
  vouchers: [
    { id: 'v1', code: 'HEMAT20', name: 'Diskon 20%', description: 'Diskon 20% maks Rp 50.000', type: 'percentage', value: 20, minPurchase: 100000, maxDiscount: 50000, validUntil: '2025-01-31T23:59:59Z', isActive: true },
    { id: 'v2', code: 'GRATISONGKIR', name: 'Free Ongkir', description: 'Gratis ongkir maks Rp 25.000', type: 'fixed', value: 25000, minPurchase: 50000, validUntil: '2025-02-28T23:59:59Z', isActive: true },
    { id: 'v3', code: 'NEWUSER50', name: 'Diskon Rp 50.000', description: 'Diskon Rp 50.000 untuk user baru', type: 'fixed', value: 50000, minPurchase: 200000, validUntil: '2025-03-31T23:59:59Z', sellerId: 's1', isActive: true },
    { id: 'v4', code: 'FLASH10', name: 'Flash Sale 10%', description: 'Diskon 10% untuk Flash Sale', type: 'percentage', value: 10, minPurchase: 0, maxDiscount: 30000, validUntil: '2024-12-31T23:59:59Z', isActive: true },
  ],
  selectedVoucher: null,

  // Search
  searchQuery: '',
  searchHistory: ['iPhone 15', 'Skincare', 'Sepatu Nike', 'Laptop Gaming'],
  setSearchQuery: (q) => set({ searchQuery: q }),
  addSearchHistory: (q) => set((state) => ({
    searchHistory: [q, ...state.searchHistory.filter(s => s !== q)].slice(0, 10)
  })),
  clearSearchHistory: () => set({ searchHistory: [] }),
}))

// ==================== CART STORE ====================
interface CartState {
  items: CartItem[]
  addItem: (product: Product, variant?: ProductVariant, quantity?: number) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  toggleCheck: (id: string) => void
  toggleAllCheck: (checked: boolean) => void
  clearCart: () => void
  getCheckedItems: () => CartItem[]
  getTotal: () => number
  getCheckedTotal: () => number
  getCheckedCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [
    {
      id: 'c1', productId: '1', quantity: 1, isChecked: true,
      product: {
        id: '1', sellerId: 's1', categoryId: 'cat1', name: 'iPhone 15 Pro Max 256GB', slug: 'iphone-15-pro-max',
        description: 'iPhone 15 Pro Max dengan chip A17 Pro', price: 21999000, stock: 50, sold: 1200,
        minOrder: 1, weight: 221, condition: 'new', status: 'active', rating: 4.9, reviewCount: 3520,
        isFeatured: true, isFlashSale: false, images: [], variants: [],
        seller: { id: 's1', userId: 'u2', storeName: 'Gadget Pro Store', storeSlug: 'gadget-pro', isVerified: true, isPremium: true, rating: 4.9, totalSales: 15000, totalProducts: 250 },
        category: { id: 'cat1', name: 'Handphone', slug: 'handphone' }
      }
    },
    {
      id: 'c2', productId: '5', variantId: 'v1', quantity: 2, isChecked: true,
      product: {
        id: '5', sellerId: 's2', categoryId: 'cat3', name: 'Sneakers Nike Air Max 90', slug: 'nike-air-max-90',
        description: 'Nike Air Max 90 classic', price: 1299000, discountPrice: 999000, stock: 30, sold: 850,
        minOrder: 1, weight: 800, condition: 'new', status: 'active', rating: 4.7, reviewCount: 1200,
        isFeatured: false, isFlashSale: true, flashSaleEnd: '2024-12-25T23:59:59Z', images: [], variants: [],
        seller: { id: 's2', userId: 'u3', storeName: 'Fashion Hub', storeSlug: 'fashion-hub', isVerified: true, isPremium: false, rating: 4.7, totalSales: 8000, totalProducts: 120 },
        category: { id: 'cat3', name: 'Sepatu', slug: 'sepatu' }
      },
      variant: { id: 'v1', productId: '5', name: 'Ukuran', value: '42', stock: 10 }
    }
  ],
  addItem: (product, variant, quantity = 1) => set((state) => {
    const existing = state.items.find(i =>
      i.productId === product.id && i.variantId === (variant?.id || undefined)
    )
    if (existing) {
      return {
        items: state.items.map(i =>
          i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      }
    }
    return {
      items: [...state.items, {
        id: `c${Date.now()}`,
        productId: product.id,
        variantId: variant?.id,
        quantity,
        isChecked: true,
        product,
        variant
      }]
    }
  }),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
  updateQuantity: (id, quantity) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i)
  })),
  toggleCheck: (id) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, isChecked: !i.isChecked } : i)
  })),
  toggleAllCheck: (checked) => set((state) => ({
    items: state.items.map(i => ({ ...i, isChecked: checked }))
  })),
  clearCart: () => set({ items: [] }),
  getCheckedItems: () => get().items.filter(i => i.isChecked),
  getTotal: () => get().items.reduce((sum, i) => sum + ((i.product.discountPrice || i.product.price) * i.quantity), 0),
  getCheckedTotal: () => get().items.filter(i => i.isChecked).reduce((sum, i) => sum + ((i.product.discountPrice || i.product.price) * i.quantity), 0),
  getCheckedCount: () => get().items.filter(i => i.isChecked).length,
}))

// ==================== WISHLIST STORE ====================
interface WishlistState {
  productIds: string[]
  toggleWishlist: (productId: string) => void
  isWishlisted: (productId: string) => boolean
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  productIds: ['3', '5', '8'],
  toggleWishlist: (productId) => set((state) => ({
    productIds: state.productIds.includes(productId)
      ? state.productIds.filter(id => id !== productId)
      : [...state.productIds, productId]
  })),
  isWishlisted: (productId) => get().productIds.includes(productId),
}))
