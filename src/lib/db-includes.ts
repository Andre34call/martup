// ==================== SHARED PRISMA INCLUDES ====================
// Prevents different API routes from returning different data shapes
// for the same entity type. Single source of truth for DB queries.
//
// When adding new fields, update this file rather than individual routes.
// Import and use: `import { cartItemInclude } from '@/lib/db-includes'`

// ==================== CART ITEM INCLUDE ====================
// Used by: /api/cart, /api/cart/add, /api/cart/[id], /api/cart/bulk
// Unifies the include object that was duplicated across 4 cart route files.

export const cartItemInclude = {
  product: {
    include: {
      seller: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          storeAvatar: true,
          isVerified: true,
          isPremium: true,
          rating: true,
          totalSales: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      variants: true,
    },
  },
  variant: true,
} as const

// ==================== ORDER DETAIL INCLUDE ====================
// Used by: /api/orders (response shaping), order status/cancel routes
// Provides the full order shape with items, shipping, and seller info.

export const orderDetailInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          slug: true,
        },
      },
      variant: true,
    },
  },
  shipping: true,
  seller: {
    select: {
      id: true,
      storeName: true,
      storeSlug: true,
      storeAvatar: true,
      isVerified: true,
    },
  },
} as const

// ==================== ORDER WITH SELLER PAYOUT INCLUDE ====================
// Used by: /api/wallet/debit, /api/payment/notification
// Includes commission rate for seller payout calculation.

export const orderWithSellerPayoutInclude = {
  items: true,
  seller: {
    select: {
      id: true,
      userId: true,
      storeName: true,
      commissionRate: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
    },
  },
} as const
