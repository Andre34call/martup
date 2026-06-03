// ==================== TYPES ====================

export type UserRole = 'buyer' | 'seller' | 'admin' | 'manager' | 'finance' | 'pr' | 'tech' | 'cs' | 'marketing' | 'operations' | 'legal' | 'hr'
export type ScreenName =
  | 'splash' | 'onboarding' | 'login' | 'register' | 'otp' | 'forgot-password' | 'reset-password' | 'email-verification'
  | 'home' | 'search' | 'category' | 'product-detail' | 'wishlist'
  | 'cart' | 'checkout' | 'payment' | 'order-tracking' | 'orders'
  | 'wallet' | 'deposit' | 'deposit-history' | 'deposit-detail' | 'withdraw' | 'chat' | 'chat-room'
  | 'notification' | 'profile' | 'settings' | 'voucher' | 'review'
  | 'refund' | 'help' | 'address' | 'followed-stores'
  | 'seller-shop' | 'category-detail'
  | 'privacy-policy' | 'terms-of-service' | 'refund-policy'
  | 'seller-dashboard' | 'seller-products' | 'seller-add-product'
  | 'seller-orders' | 'seller-analytics' | 'seller-chat' | 'seller-settings'
  | 'seller-campaign' | 'seller-wallet' | 'seller-withdraw' | 'seller-withdraw-history'
  | 'admin-dashboard' | 'admin-users' | 'admin-products' | 'admin-orders'
  | 'admin-withdraw' | 'admin-banner' | 'admin-analytics' | 'admin-complaints'
  | 'admin-divisions' | 'admin-workflow'
  | 'admin-categories' | 'admin-vouchers' | 'admin-deposits' | 'admin-campaigns' | 'admin-reviews' | 'admin-settings'
  | 'stream' | 'stream-create' | 'stream-search' | 'user-profile'

export interface User {
  id: string
  email: string
  phone?: string
  name: string
  username?: string
  usernameChangedAt?: string
  avatar?: string
  role: UserRole
  isVerified: boolean
  loyaltyPoints: number
  coins: number
  referralCode?: string
  twoFactorEnabled?: boolean
  emailHidden?: boolean
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
  storeAddress?: string
  storeCity?: string
  storeProvince?: string
  storePostalCode?: string
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
  paymentProof?: string
  paymentBankName?: string
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
  variantId?: string
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
  orderItemId?: string
  rating: number
  content?: string
  images?: string[]
  userName: string
  userAvatar?: string
  sellerReply?: string
  sellerReplyAt?: string
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
  type: 'order' | 'promo' | 'system' | 'chat' | 'mention'
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
  totalDivisions?: number
  totalStaff?: number
  topSellers?: Array<{ name: string; revenue: number; orders: number; rating: number }>
  categoryPerformance?: Array<{ name: string; revenue: number; percentage: number }>
  recentOrders?: Order[]
  recentUsers?: Array<{ id: string; name: string; email: string; joinedAt: string }>
}

// ==================== SELLER FINANCIAL TYPES ====================
export type WithdrawStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'processed' | 'completed'

export interface BankAccount {
  id: string
  bankName: string
  bankCode?: string
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

// ==================== DIVISION / DEPARTMENT TYPES ====================

export interface Division {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  color?: string
  headUserId?: string
  headUser?: {
    id: string
    name: string
    email: string
    avatar?: string
    role: string
  }
  memberCount: number
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// Division role mapping - which role belongs to which division
export const DIVISION_ROLE_MAP: Record<string, string[]> = {
  finance: ['finance', 'admin'],
  pr: ['pr', 'admin'],
  tech: ['tech', 'admin'],
  cs: ['cs', 'admin'],
  marketing: ['marketing', 'admin'],
  operations: ['operations', 'admin'],
  legal: ['legal', 'admin'],
  hr: ['hr', 'admin'],
}

// ==================== WORKFLOW / WORK ITEM TYPES ====================

export interface WorkItem {
  id: string
  type: string
  title: string
  description?: string
  status: string
  priority: string
  divisionId: string
  assigneeId?: string
  refType?: string
  refId?: string
  metadata?: Record<string, unknown>
  resolution?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  dueDate?: string
  division?: {
    id: string
    name: string
    slug: string
    icon?: string
    color?: string
  }
  assignee?: {
    id: string
    name: string
    avatar?: string
  }
}

export const WORK_TYPE_TO_DIVISION: Record<string, string> = {
  complaint: 'cs',
  withdrawal: 'finance',
  deposit: 'finance',
  refund: 'finance',
  product_report: 'tech',
  product_review: 'marketing',
  order_issue: 'operations',
  seller_verification: 'hr',
  legal_issue: 'legal',
  custom: 'operations',
}

export const WORK_TYPE_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
  complaint: { label: 'Keluhan', icon: '📢', color: 'orange' },
  withdrawal: { label: 'Penarikan Dana', icon: '💰', color: 'emerald' },
  deposit: { label: 'Deposit', icon: '💳', color: 'emerald' },
  refund: { label: 'Refund', icon: '↩️', color: 'red' },
  product_report: { label: 'Laporan Produk', icon: '🚨', color: 'purple' },
  product_review: { label: 'Review Produk', icon: '⭐', color: 'amber' },
  order_issue: { label: 'Masalah Pesanan', icon: '📦', color: 'blue' },
  seller_verification: { label: 'Verifikasi Seller', icon: '✅', color: 'teal' },
  legal_issue: { label: 'Isu Legal', icon: '⚖️', color: 'red' },
  custom: { label: 'Tugas Kustom', icon: '📋', color: 'gray' },
}

export const WORK_PRIORITY_DISPLAY: Record<string, { label: string; color: string }> = {
  low: { label: 'Rendah', color: 'gray' },
  normal: { label: 'Normal', color: 'blue' },
  high: { label: 'Tinggi', color: 'orange' },
  urgent: { label: 'Urgent', color: 'red' },
}

export const WORK_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  open: { label: 'Terbuka', color: 'blue' },
  in_progress: { label: 'Dikerjakan', color: 'orange' },
  resolved: { label: 'Diselesaikan', color: 'emerald' },
  closed: { label: 'Ditutup', color: 'gray' },
  escalated: { label: 'Eskalasi', color: 'red' },
}

// All staff roles (division-based)
export const STAFF_ROLES: UserRole[] = ['manager', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr']

// Roles that have elevated access (above seller/buyer)
export const ELEVATED_ROLES: UserRole[] = ['admin', 'manager', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr']

// Role display info — sorted by hierarchy level
// Super Admin > Manager > Division Admin > Admin > Seller > Buyer
export const ROLE_DISPLAY: Record<string, { label: string; color: string; icon: string; level: number }> = {
  superadmin: { label: 'Super Admin', color: 'purple', icon: '👑', level: 100 },
  manager: { label: 'Manager', color: 'violet', icon: '👔', level: 80 },
  admin: { label: 'Admin', color: 'purple', icon: '🛡️', level: 60 },
  finance: { label: 'Finance', color: 'emerald', icon: '💰', level: 50 },
  pr: { label: 'PR & Komunikasi', color: 'blue', icon: '📢', level: 50 },
  tech: { label: 'Tech & Bug', color: 'purple', icon: '🐛', level: 50 },
  cs: { label: 'Customer Service', color: 'orange', icon: '🎧', level: 50 },
  marketing: { label: 'Marketing', color: 'pink', icon: '📊', level: 50 },
  operations: { label: 'Operations', color: 'amber', icon: '⚙️', level: 50 },
  legal: { label: 'Legal', color: 'red', icon: '⚖️', level: 50 },
  hr: { label: 'HR & Admin', color: 'teal', icon: '👥', level: 50 },
  seller: { label: 'Seller', color: 'orange', icon: '🏪', level: 20 },
  buyer: { label: 'Buyer', color: 'emerald', icon: '🛒', level: 10 },
}
