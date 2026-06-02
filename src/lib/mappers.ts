import type { User, UserRole, Seller, Order, OrderStatus, Notification as AppNotification, Address, Review, WalletMutation, Banner, PlatformBankAccountInfo } from './types'

/**
 * Map raw API user data to typed User object
 */
export function mapUser(raw: any): User {
  return {
    id: raw.id,
    email: raw.email,
    phone: raw.phone || undefined,
    name: raw.name,
    username: raw.username || undefined,
    usernameChangedAt: raw.usernameChangedAt || undefined,
    avatar: raw.avatar || undefined,
    role: (raw.role as UserRole) || 'buyer',
    isVerified: raw.isVerified,
    loyaltyPoints: raw.loyaltyPoints || 0,
    coins: raw.coins || 0,
    referralCode: raw.referralCode || undefined,
    twoFactorEnabled: raw.twoFactorEnabled || false,
    emailHidden: raw.emailHidden || false,
  }
}

/**
 * Map raw API seller data to typed Seller object
 */
export function mapSeller(raw: any): Seller {
  return {
    id: raw.id,
    userId: raw.userId,
    storeName: raw.storeName,
    storeSlug: raw.storeSlug,
    storeDesc: raw.storeDesc || undefined,
    storeAvatar: raw.storeAvatar || undefined,
    storeBanner: raw.storeBanner || undefined,
    isVerified: raw.isVerified,
    isPremium: raw.isPremium,
    rating: raw.rating,
    totalSales: raw.totalSales,
    totalProducts: raw.totalProducts,
    responseTime: raw.responseTime || undefined,
    storeAddress: raw.storeAddress || undefined,
    storeCity: raw.storeCity || undefined,
    bankName: raw.bankName || undefined,
    bankAccount: raw.bankAccount || undefined,
    bankHolder: raw.bankHolder || undefined,
    autoReply: raw.autoReply || undefined,
  }
}

/**
 * Map raw API wallet mutation data to typed WalletMutation object
 */
export function mapWalletMutation(raw: any): WalletMutation {
  return {
    id: raw.id,
    type: raw.type,
    amount: raw.amount,
    balance: raw.balance,
    description: raw.description,
    refType: raw.refType || undefined,
    createdAt: raw.createdAt,
  }
}

/**
 * Map raw API order data to typed Order object.
 * Requires currentUser for default address fallback.
 */
export function mapOrder(raw: any, currentUser?: User | null): Order {
  return {
    id: raw.id,
    orderNumber: raw.orderNumber,
    userId: raw.userId,
    sellerId: raw.sellerId,
    status: raw.status as OrderStatus,
    subtotal: raw.subtotal,
    shippingCost: raw.shippingCost,
    discountAmount: raw.discountAmount || 0,
    taxAmount: raw.taxAmount || 0,
    platformFee: raw.platformFee || 0,
    totalAmount: raw.totalAmount,
    paymentMethod: raw.paymentMethod || undefined,
    paymentStatus: raw.paymentStatus || 'unpaid',
    paymentProofUrl: raw.paymentProofUrl || undefined,
    platformBankAccountId: raw.platformBankAccountId || undefined,
    escrowStatus: raw.escrowStatus || 'none',
    note: raw.note || undefined,
    items: (raw.items || []).map((item: any) => ({
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
    } : undefined,
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
    platformBankAccount: raw.platformBankAccount ? {
      id: raw.platformBankAccount.id,
      bankName: raw.platformBankAccount.bankName,
      bankCode: raw.platformBankAccount.bankCode || undefined,
      accountNumber: raw.platformBankAccount.accountNumber,
      accountHolder: raw.platformBankAccount.accountHolder,
      branch: raw.platformBankAccount.branch || undefined,
      isActive: raw.platformBankAccount.isActive,
      isDefault: raw.platformBankAccount.isDefault,
    } as PlatformBankAccountInfo : undefined,
    createdAt: raw.createdAt,
    paidAt: raw.paidAt || undefined,
    shippedAt: raw.shippedAt || undefined,
    deliveredAt: raw.deliveredAt || undefined,
  }
}

/**
 * Map raw API notification data to typed Notification object
 */
export function mapNotification(raw: any): AppNotification {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    type: raw.type as AppNotification['type'],
    isRead: raw.isRead,
    createdAt: raw.createdAt,
  }
}

/**
 * Map raw API address data to typed Address object
 */
export function mapAddress(raw: any): Address {
  return {
    id: raw.id,
    label: raw.label,
    recipient: raw.recipient,
    phone: raw.phone,
    address: raw.address,
    city: raw.city,
    province: raw.province,
    postalCode: raw.postalCode,
    isDefault: raw.isDefault,
  }
}

/**
 * Map raw API review data to typed Review object
 */
export function mapReview(raw: any): Review {
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
export function mapBanner(raw: any): Banner {
  return {
    id: raw.id,
    title: raw.title,
    image: raw.image,
    link: raw.link || '',
    position: raw.position,
  }
}
