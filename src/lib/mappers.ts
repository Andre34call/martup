import type { User, UserRole, Seller, Order, OrderStatus, Notification as AppNotification, Address, Review, WalletMutation, Banner } from './types'

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
  }
}

/**
 * Map raw API seller data to typed Seller object
 */
export function mapSeller(raw: Record<string, unknown>): Seller {
  return {
    id: raw.id as string,
    userId: raw.userId as string,
    storeName: raw.storeName as string,
    storeSlug: raw.storeSlug as string,
    storeDesc: (raw.storeDesc as string) || undefined,
    storeAvatar: (raw.storeAvatar as string) || undefined,
    storeBanner: (raw.storeBanner as string) || undefined,
    isVerified: raw.isVerified as boolean,
    isPremium: raw.isPremium as boolean,
    rating: raw.rating as number,
    totalSales: raw.totalSales as number,
    totalProducts: raw.totalProducts as number,
    responseTime: (raw.responseTime as number) || undefined,
    storeAddress: (raw.storeAddress as string) || undefined,
    storeCity: (raw.storeCity as string) || undefined,
    bankName: (raw.bankName as string) || undefined,
    bankAccount: (raw.bankAccount as string) || undefined,
    bankHolder: (raw.bankHolder as string) || undefined,
    autoReply: (raw.autoReply as string) || undefined,
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
export function mapOrder(raw: Record<string, unknown>, currentUser?: User | null): Order {
  const rawShipping = raw.shipping as Record<string, unknown> | undefined;
  const rawSeller = raw.seller as Record<string, unknown> | undefined;
  return {
    id: raw.id as string,
    orderNumber: raw.orderNumber as string,
    userId: raw.userId as string,
    sellerId: raw.sellerId as string,
    status: raw.status as OrderStatus,
    subtotal: raw.subtotal as number,
    shippingCost: raw.shippingCost as number,
    discountAmount: (raw.discountAmount as number) || 0,
    taxAmount: (raw.taxAmount as number) || 0,
    platformFee: (raw.platformFee as number) || 0,
    totalAmount: raw.totalAmount as number,
    paymentMethod: (raw.paymentMethod as string) || undefined,
    paymentStatus: raw.paymentStatus as string,
    items: ((raw.items as Record<string, unknown>[]) || []).map((item) => ({
      id: item.id as string,
      productId: item.productId as string,
      productName: item.productName as string,
      variantName: (item.variantName as string) || undefined,
      variantId: (item.variantId as string) || undefined,
      price: item.price as number,
      quantity: item.quantity as number,
      subtotal: item.subtotal as number,
      image: (item.image as string) || ((item.product as Record<string, unknown> | undefined)?.images as string[] | undefined)?.[0] || undefined,
    })),
    shipping: rawShipping ? {
      id: rawShipping.id as string,
      provider: rawShipping.provider as string,
      service: rawShipping.service as string,
      trackingNumber: (rawShipping.trackingNumber as string) || undefined,
      estimatedDays: (rawShipping.estimatedDays as string) || undefined,
      status: rawShipping.status as string,
    } : undefined,
    address: raw.addressId ? {
      id: raw.addressId as string,
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
    seller: rawSeller ? {
      id: rawSeller.id as string,
      userId: (rawSeller.userId as string) || '',
      storeName: (rawSeller.storeName as string) || 'Unknown Store',
      storeSlug: (rawSeller.storeSlug as string) || '',
      storeAvatar: (rawSeller.storeAvatar as string) || undefined,
      isVerified: (rawSeller.isVerified as boolean) || false,
      isPremium: (rawSeller.isPremium as boolean) || false,
      rating: (rawSeller.rating as number) || 0,
      totalSales: (rawSeller.totalSales as number) || 0,
      totalProducts: (rawSeller.totalProducts as number) || 0,
      storeCity: (rawSeller.storeCity as string) || undefined,
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
    createdAt: raw.createdAt as string,
    paidAt: (raw.paidAt as string) || undefined,
    shippedAt: (raw.shippedAt as string) || undefined,
    deliveredAt: (raw.deliveredAt as string) || undefined,
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
export function mapReview(raw: Record<string, unknown>): Review {
  return {
    id: raw.id as string,
    userId: raw.userId as string,
    productId: raw.productId as string,
    orderItemId: (raw.orderItemId as string) || undefined,
    rating: raw.rating as number,
    content: (raw.content as string) || undefined,
    images: (() => {
      if (!raw.images) return []
      if (typeof raw.images !== 'string') return raw.images as string[]
      try { return JSON.parse(raw.images as string) } catch { return [] }
    })(),
    userName: ((raw.user as Record<string, unknown> | undefined)?.name as string) || 'Anonymous',
    userAvatar: ((raw.user as Record<string, unknown> | undefined)?.avatar as string) || undefined,
    sellerReply: (raw.sellerReply as string) || undefined,
    sellerReplyAt: (raw.sellerReplyAt as string) || undefined,
    createdAt: raw.createdAt as string,
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
