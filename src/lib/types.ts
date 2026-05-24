// ==================== TYPES ====================

export type UserRole = 'buyer' | 'seller' | 'admin'
export type ScreenName =
  | 'splash' | 'onboarding' | 'login' | 'register' | 'otp' | 'forgot-password'
  | 'home' | 'search' | 'category' | 'product-detail' | 'wishlist'
  | 'cart' | 'checkout' | 'payment' | 'order-tracking' | 'orders'
  | 'wallet' | 'deposit' | 'withdraw' | 'chat' | 'chat-room'
  | 'notification' | 'profile' | 'settings' | 'voucher' | 'review'
  | 'refund' | 'help' | 'address' | 'followed-stores'
  | 'seller-shop' | 'category-detail'
  | 'seller-dashboard' | 'seller-products' | 'seller-add-product'
  | 'seller-orders' | 'seller-analytics' | 'seller-chat' | 'seller-settings'
  | 'seller-campaign' | 'seller-wallet' | 'seller-withdraw' | 'seller-withdraw-history'
  | 'admin-dashboard' | 'admin-users' | 'admin-products' | 'admin-orders'
  | 'admin-withdraw' | 'admin-banner' | 'admin-analytics' | 'admin-complaints'
  | 'admin-categories' | 'admin-vouchers' | 'admin-deposits' | 'admin-campaigns' | 'admin-settings'

export interface User {
  id: string
  email: string
  phone?: string
  name: string
  avatar?: string
  role: UserRole
  isVerified: boolean
  loyaltyPoints: number
  coins: number
  referralCode?: string
}

export interface Seller {
  id: string
  userId: string
  storeName: string
  storeSlug: string
  storeDesc?: string
  storeAvatar?: string
  storeBanner?: string
  isVerified: boolean
  isPremium: boolean
  rating: number
  totalSales: number
  totalProducts: number
  responseTime?: number
  bankName?: string
  bankAccount?: string
  bankHolder?: string
  autoReply?: string
}

export interface Product {
  id: string
  sellerId: string
  categoryId: string
  name: string
  slug: string
  description: string
  price: number
  discountPrice?: number
  images: string[]
  videoUrl?: string
  stock: number
  sold: number
  minOrder: number
  weight: number
  condition: 'new' | 'used'
  status: 'active' | 'draft' | 'blocked'
  rating: number
  reviewCount: number
  isFeatured: boolean
  isFlashSale: boolean
  flashSaleEnd?: string
  tags?: string[]
  variants: ProductVariant[]
  seller: Seller
  category: Category
}

export interface ProductVariant {
  id: string
  productId: string
  name: string
  value: string
  sku?: string
  price?: number
  stock: number
  image?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon?: string
  image?: string
  parentId?: string
  children?: Category[]
  productCount?: number
}

export interface CartItem {
  id: string
  productId: string
  variantId?: string
  quantity: number
  isChecked: boolean
  product: Product
  variant?: ProductVariant
}

export interface Address {
  id: string
  label: string
  recipient: string
  phone: string
  address: string
  city: string
  province: string
  postalCode: string
  isDefault: boolean
}

export interface Order {
  id: string
  orderNumber: string
  userId: string
  sellerId: string
  status: OrderStatus
  subtotal: number
  shippingCost: number
  discountAmount: number
  taxAmount: number
  platformFee: number
  totalAmount: number
  paymentMethod?: string
  paymentStatus: string
  items: OrderItem[]
  shipping?: Shipping
  address: Address
  seller: Seller
  buyerName?: string
  createdAt: string
  paidAt?: string
  shippedAt?: string
  deliveredAt?: string
}

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

export interface OrderItem {
  id: string
  productId: string
  productName: string
  variantName?: string
  price: number
  quantity: number
  subtotal: number
  image?: string
}

export interface Shipping {
  id: string
  provider: string
  service: string
  trackingNumber?: string
  estimatedDays?: string
  status: string
}

export interface Review {
  id: string
  userId: string
  productId: string
  rating: number
  content?: string
  images?: string[]
  userName: string
  userAvatar?: string
  createdAt: string
}

export interface Wallet {
  id: string
  balance: number
  holdBalance: number
}

export interface WalletMutation {
  id: string
  type: 'credit' | 'debit'
  amount: number
  balance: number
  description: string
  refType?: string
  createdAt: string
}

export interface Voucher {
  id: string
  code: string
  name: string
  description?: string
  type: 'percentage' | 'fixed'
  value: number
  minPurchase: number
  maxDiscount?: number
  validUntil: string
  sellerId?: string
  isActive: boolean
}

export interface Notification {
  id: string
  title: string
  content: string
  type: 'order' | 'promo' | 'system' | 'chat'
  isRead: boolean
  createdAt: string
}

export interface ChatRoom {
  id: string
  seller: Seller
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  product?: Product
}

export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  content: string
  type: 'text' | 'image' | 'product' | 'order'
  isRead: boolean
  createdAt: string
}

export interface Banner {
  id: string
  title: string
  image: string
  link?: string
  position: string
}

export interface SearchResult {
  products: Product[]
  total: number
  suggestions: string[]
}

export interface ShippingOption {
  provider: string
  service: string
  name: string
  price: number
  estimatedDays: string
  logo: string
}

export interface SellerStats {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  totalVisitors: number
  pendingOrders: number
  monthlyRevenue: { month: string; revenue: number }[]
  topProducts: { name: string; sold: number; revenue: number }[]
  recentOrders: Order[]
}

export interface AdminStats {
  totalUsers: number
  totalSellers: number
  totalOrders: number
  totalRevenue: number
  pendingWithdrawals: number
  activeProducts: number
  openComplaints: number
  unverifiedSellers: number
  pendingWithdrawalAmount: number
  revenueChart: { date: string; revenue: number }[]
  userGrowth: { date: string; users: number }[]
  paymentMethodDistribution: { method: string; count: number; percentage: number }[]
}

// ==================== SELLER FINANCIAL TYPES ====================
export type WithdrawStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed'

export interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountHolder: string
  isDefault: boolean
}

export interface WithdrawRequest {
  id: string
  sellerId: string
  sellerName: string
  amount: number
  adminFee: number
  netAmount: number
  bankAccount: BankAccount
  status: WithdrawStatus
  requestDate: string
  processedDate?: string
  completedDate?: string
  rejectionReason?: string
  estimatedArrival?: string
}

export interface SellerBalance {
  availableBalance: number  // Can be withdrawn
  pendingBalance: number    // From orders not yet completed
  holdBalance: number       // Under dispute / processing
  totalBalance: number      // All balances combined
  totalWithdrawn: number    // Historical total withdrawn
  lastWithdrawDate?: string
}
