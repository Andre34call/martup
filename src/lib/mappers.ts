import type { User, UserRole, Seller, Order, OrderStatus, Notification as AppNotification, Address, Review, WalletMutation, Banner, OrderItem, Shipping } from './types'

// ==================== RAW API TYPES ====================
// These represent the shape of data as it comes from the API (before mapping)

interface RawSeller {
  id: string
  userId?: string
  storeName?: string
  storeSlug?: string
  storeDesc?: string
  storeAvatar?: string
  storeBanner?: string
  isVerified?: boolean
  isPremium?: boolean
  rating?: number
  totalSales?: number
  totalProducts?: number
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

interface RawOrderItem {
  id: string
  productId: string
  productName: string
  variantName?: string
  variantId?: string
  price: number
  quantity: number
  subtotal: number
  image?: string
  product?: { images?: string[] }
}

interface RawShipping {
  id: string
  provider: string
  service: string
  trackingNumber?: string
  estimatedDays?: string
  status: string
}

interface RawOrder {
  id: string
  orderNumber: string
  userId: string
  sellerId: string
  status: OrderStatus
  subtotal: number
  shippingCost: number
  discountAmount?: number
  taxAmount?: number
  platformFee?: number
  totalAmount: number
  paymentMethod?: string
  paymentStatus: string
  paymentProof?: string
  paymentBankName?: string
  items?: RawOrderItem[]
  shipping?: RawShipping
  addressId?: string
  seller?: RawSeller
  createdAt: string
  paidAt?: string
  shippedAt?: string
  deliveredAt?: string
}

interface RawReviewUser {
  name?: string
  avatar?: string
}

interface RawReview {
  id: string
  userId: string
  productId: string
  orderItemId?: string
  rating: number
  content?: string
  images?: string | string[]
  user?: RawReviewUser
  sellerReply?: string
  sellerReplyAt?: string
  createdAt: string
}

/**
 * Map raw API user data to typed User object
 */
export function mapUser(raw: Record<string, unknown>): User {
  return {
    id: raw.id as string,
    email: raw.email as string,
    phone: (raw.phone as string) || undefined,
    name: raw.name as string,
    avatar: (raw.avatar as string) || undefined,
    role: (raw.role as UserRole) || 'buyer',
    isVerified: raw.isVerified as boolean,
    loyaltyPoints: (raw.loyaltyPoints as number) || 0,
    coins: (raw.coins as number) || 0,
    referralCode: (raw.referralCode as string) || undefined,
    twoFactorEnabled: (raw.twoFactorEnabled as boolean) || false,
    emailHidden: (raw.emailHidden as boolean) || false,
  }
}

/**
 * Map raw API seller data to typed Seller object
 */
export function mapSeller(raw: RawSeller): Seller {
  return {
    id: raw.id,
    userId: raw.userId ?? '',
    storeName: raw.storeName ?? '',
    storeSlug: raw.storeSlug ?? '',
    storeDesc: raw.storeDesc || undefined,
    storeAvatar: raw.storeAvatar || undefined,
    storeBanner: raw.storeBanner || undefined,
    isVerified: raw.isVerified ?? false,
    isPremium: raw.isPremium ?? false,
    rating: raw.rating ?? 0,
    totalSales: raw.totalSales ?? 0,
    totalProducts: raw.totalProducts ?? 0,
    responseTime: raw.responseTime || undefined,
    storeAddress: raw.storeAddress || undefined,
    storeCity: raw.storeCity || undefined,
    storeProvince: raw.storeProvince || undefined,
    storePostalCode: raw.storePostalCode || undefined,
    bankName: raw.bankName || undefined,
    bankAccount: raw.bankAccount || undefined,
    bankHolder: raw.bankHolder || undefined,
    autoReply: raw.autoReply || undefined,
  }
}

/**
 * Map raw API wallet mutation data to typed WalletMutation object
 */
export function mapWalletMutation(raw: Record<string, unknown>): WalletMutation {
  return {
    id: raw.id as string,
    type: raw.type as 'credit' | 'debit',
    amount: raw.amount as number,
    balance: raw.balance as number,
    description: raw.description as string,
    refType: (raw.refType as string) || undefined,
    createdAt: raw.createdAt as string,
  }
}

/**
 * Map raw API order data to typed Order object.
 * Requires currentUser for default address fallback.
 */
export function mapOrder(raw: RawOrder, currentUser?: User | null): Order {
  return {
    id: raw.id,
    orderNumber: raw.orderNumber,
    userId: raw.userId,
    sellerId: raw.sellerId,
    status: raw.status,
    subtotal: raw.subtotal,
    shippingCost: raw.shippingCost,
    discountAmount: raw.discountAmount || 0,
    taxAmount: raw.taxAmount || 0,
    platformFee: raw.platformFee || 0,
    totalAmount: raw.totalAmount,
    paymentMethod: raw.paymentMethod || undefined,
    paymentStatus: raw.paymentStatus,
    paymentProof: raw.paymentProof || undefined,
    paymentBankName: raw.paymentBankName || undefined,
    items: (raw.items || []).map((item: RawOrderItem): OrderItem => ({
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
    shipping: raw.shipping ? {
      id: raw.shipping.id,
      provider: raw.shipping.provider,
      service: raw.shipping.service,
      trackingNumber: raw.shipping.trackingNumber || undefined,
      estimatedDays: raw.shipping.estimatedDays || undefined,
      status: raw.shipping.status,
    } as Shipping : undefined,
    address: raw.addressId ? {
      id: raw.addressId,
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
      recipient: currentUser?.name || '',
      phone: currentUser?.phone || '',
      address: 'Alamat pengiriman',
      city: '',
      province: '',
      postalCode: '',
      isDefault: true,
    },
    seller: raw.seller ? {
      id: raw.seller.id,
      userId: raw.seller.userId || '',
      storeName: raw.seller.storeName || 'Unknown Store',
      storeSlug: raw.seller.storeSlug || '',
      storeAvatar: raw.seller.storeAvatar || undefined,
      isVerified: raw.seller.isVerified || false,
      isPremium: raw.seller.isPremium || false,
      rating: raw.seller.rating || 0,
      totalSales: raw.seller.totalSales || 0,
      totalProducts: raw.seller.totalProducts || 0,
      storeCity: raw.seller.storeCity || undefined,
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
    createdAt: raw.createdAt,
    paidAt: raw.paidAt || undefined,
    shippedAt: raw.shippedAt || undefined,
    deliveredAt: raw.deliveredAt || undefined,
  }
}

/**
 * Map raw API notification data to typed Notification object
 */
export function mapNotification(raw: Record<string, unknown>): AppNotification {
  return {
    id: raw.id as string,
    title: raw.title as string,
    content: raw.content as string,
    type: raw.type as AppNotification['type'],
    isRead: raw.isRead as boolean,
    createdAt: raw.createdAt as string,
  }
}

/**
 * Map raw API address data to typed Address object
 */
export function mapAddress(raw: Record<string, unknown>): Address {
  return {
    id: raw.id as string,
    label: raw.label as string,
    recipient: raw.recipient as string,
    phone: raw.phone as string,
    address: raw.address as string,
    city: raw.city as string,
    province: raw.province as string,
    postalCode: raw.postalCode as string,
    isDefault: raw.isDefault as boolean,
  }
}

/**
 * Map raw API review data to typed Review object
 */
export function mapReview(raw: RawReview): Review {
  return {
    id: raw.id,
    userId: raw.userId,
    productId: raw.productId,
    orderItemId: raw.orderItemId || undefined,
    rating: raw.rating,
    content: raw.content || undefined,
    images: (() => {
      if (!raw.images) return []
      if (typeof raw.images !== 'string') return raw.images
      try { return JSON.parse(raw.images) } catch { return [] }
    })(),
    userName: raw.user?.name || 'Anonymous',
    userAvatar: raw.user?.avatar || undefined,
    sellerReply: raw.sellerReply || undefined,
    sellerReplyAt: raw.sellerReplyAt || undefined,
    createdAt: raw.createdAt,
  }
}

/**
 * Map raw API banner data to typed Banner object
 */
export function mapBanner(raw: Record<string, unknown>): Banner {
  return {
    id: raw.id as string,
    title: raw.title as string,
    image: raw.image as string,
    link: (raw.link as string) || '',
    position: raw.position as string,
  }
}
