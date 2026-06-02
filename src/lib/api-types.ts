/**
 * API Response Types — Client-Side
 *
 * Shared type definitions for API responses consumed by Zustand store slices.
 * These types mirror the server-side response shapes but are safe to import
 * in client-side code (no Next.js server-only dependencies).
 *
 * Convention:
 *   - All successful API responses follow `{ success: true, data: T }`
 *   - All error responses follow `{ success: false, error: string, details? }`
 *   - Some legacy endpoints wrap data differently; those use specific types
 */

// ==================== GENERIC RESPONSE WRAPPERS ====================

/** Standard success response from API routes */
export interface ApiSuccess<T = unknown> {
  success: true
  data: T
  message?: string
}

/** Standard error response from API routes */
export interface ApiError {
  success: false
  error: string
  details?: unknown
}

/** Combined API response — either success or error */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

// ==================== /api/user-data ====================

/** Seller with wallet relation (from Prisma include) */
export interface SellerWithWallet {
  id: string
  userId: string
  storeName: string
  storeSlug: string
  storeDesc?: string | null
  storeAvatar?: string | null
  storeBanner?: string | null
  storeAddress?: string | null
  storeCity?: string | null
  storeProvince?: string | null
  storePostalCode?: string | null
  isVerified: boolean
  isPremium: boolean
  rating: number
  totalSales: number
  totalProducts: number
  responseTime?: number | null
  bankAccount?: string | null
  bankName?: string | null
  bankHolder?: string | null
  autoReply?: string | null
  commissionRate: number
  wallet?: SellerWalletData | null
}

/** Wallet data as returned from Prisma (Decimals serialized to numbers by serializeDecimal) */
export interface SellerWalletData {
  id: string
  balance: number
  holdBalance: number
  pendingBalance: number
}

/** Wallet data with mutations */
export interface WalletWithMutations {
  id: string
  balance: number
  holdBalance: number
  coins?: number
  mutations?: WalletMutationData[]
}

/** Wallet mutation raw data */
export interface WalletMutationData {
  id: string
  type: string
  amount: number
  balance: number
  description: string
  refType?: string | null
  createdAt: string
}

/** User data payload from /api/user-data */
export interface UserDataPayload {
  user: Record<string, unknown>
  seller?: SellerWithWallet | null
  wallet?: WalletWithMutations | null
  orders?: Record<string, unknown>[]
  notifications?: Record<string, unknown>[]
  unreadNotificationCount?: number
  addresses?: Record<string, unknown>[]
  reviews?: Record<string, unknown>[]
  wishlistProductIds?: string[]
  followedStoreIds?: string[]
}

/** /api/user-data response */
export type UserDataResponse = ApiSuccess<UserDataPayload>

// ==================== /api/products ====================

/** Raw product data from API (before mapping) */
export interface ProductRawData {
  id: string
  sellerId: string
  categoryId: string
  name: string
  slug: string
  description: string
  price: number
  discountPrice?: number | null
  images: string | string[]
  videoUrl?: string | null
  stock: number
  sold: number
  minOrder?: number
  weight: number
  condition?: string
  status: string
  rating: number
  reviewCount: number
  isFeatured: boolean
  isFlashSale: boolean
  flashSaleEnd?: string | null
  tags?: string | string[] | null
  variants?: ProductVariantRawData[]
  seller?: Record<string, unknown>
  category?: Record<string, unknown>
}

export interface ProductVariantRawData {
  id: string
  productId: string
  name: string
  value: string
  sku?: string | null
  price?: number | null
  stock: number
  image?: string | null
}

/** /api/products response */
export interface ProductsResponse {
  success?: boolean
  data?: ProductRawData[]
  products?: ProductRawData[]
  [key: string]: unknown
}

// ==================== /api/categories ====================

/** Raw category data from API */
export interface CategoryRawData {
  id: string
  name: string
  slug: string
  icon?: string | null
  image?: string | null
  parentId?: string | null
  productCount?: number
  _count?: { products: number }
  children?: CategoryRawData[]
}

/** /api/categories response */
export interface CategoriesResponse {
  success?: boolean
  data?: CategoryRawData[]
  categories?: CategoryRawData[]
  [key: string]: unknown
}

// ==================== /api/orders ====================

/** /api/orders response */
export interface OrdersResponse {
  success: boolean
  data?: Record<string, unknown>[]
  error?: string
}

// ==================== /api/banners ====================

/** /api/banners response */
export interface BannersResponse {
  success?: boolean
  data?: Record<string, unknown>[]
  [key: string]: unknown
}

// ==================== /api/seller/stats ====================

/** /api/seller/stats response */
export interface SellerStatsResponse {
  success?: boolean
  data?: Record<string, unknown>
  [key: string]: unknown
}

// ==================== /api/seller/withdraw ====================

/** /api/seller/withdraw history response */
export interface WithdrawHistoryResponse {
  success?: boolean
  data?: { withdrawals?: Record<string, unknown>[] } | Record<string, unknown>[]
  [key: string]: unknown
}

// ==================== /api/admin/* ====================

/** /api/admin/users response */
export interface AdminUsersResponse {
  success: boolean
  data?: Record<string, unknown>[]
  users?: Record<string, unknown>[]
}

/** /api/admin/divisions response */
export interface AdminDivisionsResponse {
  success: boolean
  divisions: Record<string, unknown>[]
}

/** /api/admin/withdrawals response */
export interface AdminWithdrawalsResponse {
  success: boolean
  data: Record<string, unknown>[]
}

/** /api/admin/banners response */
export interface AdminBannersResponse {
  success: boolean
  data: Record<string, unknown>[]
}

/** /api/admin/complaints response */
export interface AdminComplaintsResponse {
  success: boolean
  data: Record<string, unknown>[]
}

/** /api/admin/orders response */
export interface AdminOrdersResponse {
  success: boolean
  data: Record<string, unknown>[]
}

/** /api/admin/stats response */
export interface AdminStatsResponse {
  success: boolean
  data: Record<string, unknown>
}

/** /api/admin/settings response */
export interface PlatformSettingsResponse {
  success: boolean
  data: Record<string, number | boolean | string>
}

// ==================== /api/chat/* ====================

/** /api/chat/rooms response */
export interface ChatRoomsResponse {
  success: boolean
  data?: Record<string, unknown>[]
}

/** /api/chat/messages response */
export interface ChatMessagesResponse {
  success: boolean
  data?: Record<string, unknown>[]
}

// ==================== /api/reviews ====================

/** /api/reviews response */
export interface ProductReviewsResponse {
  success?: boolean
  data?: Record<string, unknown>[]
  [key: string]: unknown
}

// ==================== /api/cart ====================

/** /api/cart response */
export interface CartSyncResponse {
  success: boolean
  data?: Record<string, unknown>[]
  error?: string
}

// ==================== /api/wallet ====================

/** /api/wallet balance response */
export interface WalletBalanceResponse {
  success: boolean
  data?: {
    balance: number
    holdBalance: number
    coins?: number
    mutations?: Record<string, unknown>[]
  }
  error?: string
}

/** /api/wallet/mutations response */
export interface WalletMutationsResponse {
  items?: Record<string, unknown>[]
  mutations?: Record<string, unknown>[]
  [key: string]: unknown
}

// ==================== /api/notifications ====================

/** /api/notifications response */
export interface NotificationsResponse {
  success: boolean
  data?: Record<string, unknown>[]
}

// ==================== /api/user/avatar ====================

/** /api/user/avatar upload response */
export interface AvatarUploadResponse {
  success?: boolean
  data?: { avatar?: string } | string
  [key: string]: unknown
}

// ==================== /api/user/settings ====================

/** /api/user/settings response */
export interface UserSettingsResponse {
  success?: boolean
  data?: Record<string, unknown>
  twoFactor?: boolean
  pushNotif?: boolean
  emailNotif?: boolean
  dataSharing?: boolean
  [key: string]: unknown
}

// ==================== /api/addresses ====================

/** /api/addresses mutation response */
export interface AddressMutationResponse {
  success?: boolean
  data?: Record<string, unknown>
  error?: string
}

/** /api/addresses list response */
export interface AddressesListResponse {
  success?: boolean
  data?: Record<string, unknown>[]
  error?: string
}
