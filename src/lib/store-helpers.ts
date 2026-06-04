/**
 * Store Helpers — Shared utilities for Zustand store slices
 *
 * Extracts duplicated logic from multiple store slices into
 * reusable functions with proper typing.
 */

import type { SellerBalance, SellerWalletData } from './types'

// ==================== SELLER BALANCE MAPPING ====================

/**
 * Map a seller's wallet data to the SellerBalance store shape.
 *
 * Used in:
 *   - store/auth.ts (switchRole)
 *   - store/data-fetch.ts (fetchUserData)
 */
export function mapSellerWalletToBalance(wallet: SellerWalletData): SellerBalance {
  const walletBal = Number(wallet.balance) || 0
  const walletHold = Number(wallet.holdBalance) || 0
  const walletPending = Number(wallet.pendingBalance) || 0
  return {
    availableBalance: walletBal,
    pendingBalance: walletPending,
    holdBalance: walletHold,
    totalBalance: walletBal + walletHold + walletPending,
    totalWithdrawn: 0,
  }
}

// ==================== LOGOUT RESET STATE ====================

/**
 * Get the default reset state for logout/deleteAccount.
 *
 * Extracted from the duplicated 30+ line `set({...})` blocks
 * in store/auth.ts `logout` and `deleteAccount`.
 *
 * IMPORTANT: When adding new state fields to AppStore, add them here too
 * to ensure they're properly reset on logout.
 */
export function getResetState() {
  return {
    isAuthenticated: false as const,
    currentUser: null,
    userRole: 'buyer' as const,
    originalRole: 'buyer' as const,
    isSuperAdminUser: false,
    currentScreen: 'login' as const,
    orders: [],
    isOrdersLoaded: false,
    notifications: [],
    unreadNotificationCount: 0,
    addresses: [],
    selectedAddressId: null as string | null,
    walletBalance: 0,
    walletHoldBalance: 0,
    walletCoins: 0,
    walletMutations: [],
    reviews: [],
    reviewedOrderIds: [],
    followedStoreIds: [],
    seller: null,
    sellerStats: null,
    isDataLoaded: false,
    isSettingsLoaded: false,
    isWalletLoaded: false,
    sellerBalance: {
      availableBalance: 0,
      pendingBalance: 0,
      holdBalance: 0,
      totalBalance: 0,
      totalWithdrawn: 0,
    },
    sellerBankAccounts: [],
    withdrawRequests: [],
    adminUsers: [],
    adminBanners: [],
    adminComplaints: [],
    adminStats: null,
    adminOrders: [],
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
    products: [],
    categories: [],
  }
}

// ==================== SAFE JSON PARSING ====================

/**
 * Safely parse a JSON string field, returning a default on failure.
 *
 * Unlike `parseJsonField` in api-utils.ts (server-side), this is
 * safe to import in client-side code.
 */
export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (!value) return fallback
  if (Array.isArray(value)) return value as T
  if (typeof value !== 'string') return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

// ==================== CHAT ROOM MAPPING ====================

/** Minimal product preview for chat room cards */
export interface ChatProductPreview {
  id: string
  name: string
  price: number
  images: string[]
}

/**
 * Map raw chat room data from API to a ChatRoom-compatible product preview.
 *
 * Used in:
 *   - store/chat.ts (fetchChatRooms)
 *   - store/chat.ts (createChatRoom)
 */
export function mapChatProductPreview(productData: Record<string, unknown>): ChatProductPreview {
  return {
    id: productData.id as string,
    name: productData.name as string,
    price: Number(productData.price) || 0,
    images: safeJsonParse<string[]>(productData.images, []),
  }
}

/**
 * Map raw seller data from a chat room's otherUser to a Seller-compatible object.
 *
 * Used in:
 *   - store/chat.ts (fetchChatRooms)
 *   - store/chat.ts (createChatRoom)
 */
export function mapChatSeller(otherUser: Record<string, unknown> | undefined) {
  const sellerData = (otherUser?.seller as Record<string, unknown>) || {}
  return {
    id: (sellerData.id as string) || (otherUser?.id as string) || '',
    userId: (otherUser?.id as string) || '',
    storeName: (otherUser?.name as string) || (sellerData.storeName as string) || 'Seller',
    storeSlug: (sellerData.storeSlug as string) || '',
    storeAvatar: (otherUser?.avatar as string) || (sellerData.storeAvatar as string) || undefined,
    isVerified: (sellerData.isVerified as boolean) || false,
    isPremium: (sellerData.isPremium as boolean) || false,
    rating: (sellerData.rating as number) || 0,
    totalSales: (sellerData.totalSales as number) || 0,
    totalProducts: (sellerData.totalProducts as number) || 0,
  }
}
