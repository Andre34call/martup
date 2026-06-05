import type { User, UserRole, Seller, Order, OrderStatus, Notification as AppNotification, Address, Review, WalletMutation, Banner, OrderItem, Shipping } from './types'

// ==================== RAW API TYPES ====================
// These represent the shape of data as it comes from the API (before mapping)

export interface RawSeller {
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
  price: number | { toNumber?: () => number }
  quantity: number | { toNumber?: () => number }
  subtotal: number | { toNumber?: () => number }
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
  subtotal: number | { toNumber?: () => number }
  shippingCost: number | { toNumber?: () => number }
  discountAmount?: number | { toNumber?: () => number }
  taxAmount?: number | { toNumber?: () => number }
  platformFee?: number | { toNumber?: () => number }
  totalAmount: number | { toNumber?: () => number }
  paymentMethod?: string
  paymentStatus: string
  paymentReference?: string
  paymentProof?: string
  paymentBankName?: string
  isServiceOrder?: boolean
  serviceProofImages?: string
  sellerCompletedAt?: string | Date | number | null
  buyerConfirmedAt?: string | Date | number | null
  autoConfirmAt?: string | Date | number | null
  items?: RawOrderItem[]
  shipping?: RawShipping
  addressId?: string
  address?: Order['address']
  seller?: RawSeller | Order['seller']
  buyerName?: string
  createdAt: string | Date | number
  paidAt?: string | Date | number | null
  shippedAt?: string | Date | number | null
  deliveredAt?: string | Date | number | null
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
 * Map raw API wallet mutation data to typed WalletMutation object.
 * Uses Number() and String() for safe conversion from Prisma Decimal/string fields.
 */
export function mapWalletMutation(raw: Record<string, unknown>): WalletMutation {
  return {
    id: String(raw.id),
    type: raw.type as 'credit' | 'debit',
    amount: Number(raw.amount),
    balance: Number(raw.balance),
    description: String(raw.description || ''),
    refType: raw.refType ? String(raw.refType) : undefined,
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
  }
}

/** Helper: safely convert Prisma Decimal or number to JS number */
function toNumber(value: number | { toNumber?: () => number } | undefined | null, fallback = 0): number {
  if (value == null) return fallback
  if (typeof value === 'number') return value
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber()
  return fallback
}

/** Helper: normalize a date field to ISO string */
function normalizeDate(value: string | Date | number | null | undefined): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value
  return new Date(value as number | Date).toISOString()
}

/**
 * Map raw API order data to typed Order object.
 * Handles Prisma Decimal fields, Date objects, and missing relations.
 * Requires currentUser for default address fallback when no address is present.
 */
export function mapOrder(raw: RawOrder, currentUser?: User | null): Order {
  // If seller is already a mapped object (has storeName), pass through; otherwise map it
  const seller: Order['seller'] = raw.seller
    ? ('storeName' in raw.seller && typeof raw.seller.storeName === 'string'
      ? raw.seller as Order['seller']
      : {
          id: (raw.seller as RawSeller).id,
          userId: (raw.seller as RawSeller).userId || '',
          storeName: (raw.seller as RawSeller).storeName || 'Unknown Store',
          storeSlug: (raw.seller as RawSeller).storeSlug || '',
          storeAvatar: (raw.seller as RawSeller).storeAvatar || undefined,
          isVerified: (raw.seller as RawSeller).isVerified || false,
          isPremium: (raw.seller as RawSeller).isPremium || false,
          rating: (raw.seller as RawSeller).rating || 0,
          totalSales: (raw.seller as RawSeller).totalSales || 0,
          totalProducts: (raw.seller as RawSeller).totalProducts || 0,
          storeCity: (raw.seller as RawSeller).storeCity || undefined,
        })
    : {
        id: '',
        userId: '',
        storeName: 'Unknown Seller',
        storeSlug: '',
        isVerified: false,
        isPremium: false,
        rating: 0,
        totalSales: 0,
        totalProducts: 0,
      }

  // If address is already a mapped object, pass through; otherwise construct from addressId or fallback
  const address: Order['address'] = raw.address
    ? raw.address
    : raw.addressId
      ? {
          id: raw.addressId,
          label: '',
          recipient: '',
          phone: '',
          address: '',
          city: '',
          province: '',
          postalCode: '',
          isDefault: false,
        }
      : {
          id: 'default',
          label: 'Alamat',
          recipient: currentUser?.name || '',
          phone: currentUser?.phone || '',
          address: 'Alamat pengiriman',
          city: '',
          province: '',
          postalCode: '',
          isDefault: true,
        }

  return {
    id: raw.id,
    orderNumber: raw.orderNumber,
    userId: raw.userId,
    sellerId: raw.sellerId,
    status: raw.status,
    subtotal: toNumber(raw.subtotal),
    shippingCost: toNumber(raw.shippingCost),
    discountAmount: toNumber(raw.discountAmount),
    taxAmount: toNumber(raw.taxAmount),
    platformFee: toNumber(raw.platformFee),
    totalAmount: toNumber(raw.totalAmount),
    paymentMethod: raw.paymentMethod || undefined,
    paymentStatus: raw.paymentStatus || 'unpaid',
    paymentReference: raw.paymentReference || undefined,
    paymentProof: raw.paymentProof || undefined,
    paymentBankName: raw.paymentBankName || undefined,
    isServiceOrder: raw.isServiceOrder || false,
    serviceProofImages: (() => {
      if (!raw.serviceProofImages) return undefined
      if (Array.isArray(raw.serviceProofImages)) return raw.serviceProofImages as string[]
      try { return JSON.parse(raw.serviceProofImages as string) as string[] } catch { return undefined }
    })(),
    sellerCompletedAt: normalizeDate(raw.sellerCompletedAt),
    buyerConfirmedAt: normalizeDate(raw.buyerConfirmedAt),
    autoConfirmAt: normalizeDate(raw.autoConfirmAt),
    items: (raw.items || []).map((item: RawOrderItem): OrderItem => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      variantName: item.variantName || undefined,
      variantId: item.variantId || undefined,
      price: toNumber(item.price),
      quantity: toNumber(item.quantity),
      subtotal: toNumber(item.subtotal),
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
    address,
    seller,
    buyerName: raw.buyerName || undefined,
    createdAt: normalizeDate(raw.createdAt) || String(raw.createdAt),
    paidAt: normalizeDate(raw.paidAt),
    shippedAt: normalizeDate(raw.shippedAt),
    deliveredAt: normalizeDate(raw.deliveredAt),
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
