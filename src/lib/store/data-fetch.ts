import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { DataFetchSlice, AppStore } from './types'
import type { User, UserRole, Seller, OrderStatus, Notification as AppNotification } from '../types'
import { getAuthHeaders } from './getAuthHeaders'

// We need a reference to the wishlist store for fetchUserData - import it lazily
let _useWishlistStore: any = null
export function setWishlistStoreRef(wishlistStore: any) {
  _useWishlistStore = wishlistStore
}

export const createDataFetchSlice: StateCreator<AppStore, [], [], DataFetchSlice> = (set, get) => ({
  isDataLoaded: false,
  homeBanners: [],

  fetchUserData: async (userId: string) => {
    try {
      const res = await fetch(`/api/user-data?userId=${userId}`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch user data')
      const raw = await res.json()
      const data = raw.data || raw  // Unwrap { success, data } response

      const state = get()

      // Update user
      if (data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email,
          phone: data.user.phone || undefined,
          name: data.user.name,
          avatar: data.user.avatar || undefined,
          role: (data.user.role as UserRole) || 'buyer',
          isVerified: data.user.isVerified,
          loyaltyPoints: data.user.loyaltyPoints || 0,
          coins: data.user.coins || 0,
          referralCode: data.user.referralCode || undefined,
          twoFactorEnabled: data.user.twoFactorEnabled || false,
        }
        set({
          currentUser: user,
          userRole: user.role,
          isAuthenticated: true,
        })
      }

      // Update seller
      if (data.seller) {
        const seller: Seller = {
          id: data.seller.id,
          userId: data.seller.userId,
          storeName: data.seller.storeName,
          storeSlug: data.seller.storeSlug,
          storeDesc: data.seller.storeDesc || undefined,
          storeAvatar: data.seller.storeAvatar || undefined,
          storeBanner: data.seller.storeBanner || undefined,
          isVerified: data.seller.isVerified,
          isPremium: data.seller.isPremium,
          rating: data.seller.rating,
          totalSales: data.seller.totalSales,
          totalProducts: data.seller.totalProducts,
          responseTime: data.seller.responseTime || undefined,
          bankName: data.seller.bankName || undefined,
          bankAccount: data.seller.bankAccount || undefined,
          bankHolder: data.seller.bankHolder || undefined,
          autoReply: data.seller.autoReply || undefined,
        }
        set({ seller })

        // Update seller balance from seller wallet
        if (data.seller.wallet) {
          const walletBal = data.seller.wallet.balance || 0
          const walletHold = data.seller.wallet.holdBalance || 0
          const walletPending = data.seller.wallet.pendingBalance || 0
          set({
            sellerBalance: {
              availableBalance: walletBal,
              pendingBalance: walletPending,
              holdBalance: walletHold,
              totalBalance: walletBal + walletHold + walletPending,
              totalWithdrawn: 0,
            }
          })
        }
      }

      // Update wallet
      if (data.wallet) {
        set({
          walletBalance: data.wallet.balance || 0,
          walletHoldBalance: data.wallet.holdBalance || 0,
          walletMutations: (data.wallet.mutations || []).map((m: any) => ({
            id: m.id,
            type: m.type,
            amount: m.amount,
            balance: m.balance,
            description: m.description,
            refType: m.refType || undefined,
            createdAt: m.createdAt,
          })),
        })
      }

      // Update orders
      if (data.orders) {
        set({
          orders: data.orders.map((o: any) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            userId: o.userId,
            sellerId: o.sellerId,
            status: o.status as OrderStatus,
            subtotal: o.subtotal,
            shippingCost: o.shippingCost,
            discountAmount: o.discountAmount || 0,
            taxAmount: o.taxAmount || 0,
            platformFee: o.platformFee || 0,
            totalAmount: o.totalAmount,
            paymentMethod: o.paymentMethod || undefined,
            paymentStatus: o.paymentStatus,
            items: (o.items || []).map((item: any) => ({
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
            shipping: o.shipping ? {
              id: o.shipping.id,
              provider: o.shipping.provider,
              service: o.shipping.service,
              trackingNumber: o.shipping.trackingNumber || undefined,
              estimatedDays: o.shipping.estimatedDays || undefined,
              status: o.shipping.status,
            } : undefined,
            address: o.addressId ? {
              id: o.addressId,
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
              recipient: state.currentUser?.name || '',
              phone: state.currentUser?.phone || '',
              address: 'Alamat pengiriman',
              city: '',
              province: '',
              postalCode: '',
              isDefault: true,
            },
            seller: o.seller ? {
              id: o.seller.id,
              userId: o.seller.userId || '',
              storeName: o.seller.storeName || 'Unknown Store',
              storeSlug: o.seller.storeSlug || '',
              storeAvatar: o.seller.storeAvatar || undefined,
              isVerified: o.seller.isVerified || false,
              isPremium: o.seller.isPremium || false,
              rating: o.seller.rating || 0,
              totalSales: o.seller.totalSales || 0,
              totalProducts: o.seller.totalProducts || 0,
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
            createdAt: o.createdAt,
            paidAt: o.paidAt || undefined,
            shippedAt: o.shippedAt || undefined,
            deliveredAt: o.deliveredAt || undefined,
          })),
        })
      }

      // Update notifications
      if (data.notifications) {
        set({
          notifications: data.notifications.map((n: any) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            type: n.type as AppNotification['type'],
            isRead: n.isRead,
            createdAt: n.createdAt,
          })),
          unreadNotificationCount: data.unreadNotificationCount || 0,
        })
      }

      // Update addresses
      if (data.addresses) {
        set({
          addresses: data.addresses.map((a: any) => ({
            id: a.id,
            label: a.label,
            recipient: a.recipient,
            phone: a.phone,
            address: a.address,
            city: a.city,
            province: a.province,
            postalCode: a.postalCode,
            isDefault: a.isDefault,
          })),
          selectedAddressId: data.addresses.find((a: any) => a.isDefault)?.id || data.addresses[0]?.id || null,
        })
      }

      // Update reviews
      if (data.reviews) {
        set({
          reviews: data.reviews.map((r: any) => ({
            id: r.id,
            userId: r.userId,
            productId: r.productId,
            rating: r.rating,
            content: r.content || undefined,
            images: r.images ? (typeof r.images === 'string' ? JSON.parse(r.images) : r.images) : [],
            userName: r.user?.name || 'Anonymous',
            userAvatar: r.user?.avatar || undefined,
            createdAt: r.createdAt,
          })),
        })
      }

      // Update wishlist
      if (data.wishlistProductIds && data.wishlistProductIds.length > 0) {
        if (_useWishlistStore) {
          const { wishlistIds } = _useWishlistStore.getState()
          const mergedIds = [...new Set([...wishlistIds, ...data.wishlistProductIds])]
          _useWishlistStore.setState({ wishlistIds: mergedIds })
        }
      }

      set({ isDataLoaded: true })
    } catch (error) {
      logger.warn({ component: 'data-fetch', err: error }, 'Failed to fetch user data')
    }
  },

  fetchHomeBanners: async () => {
    try {
      const res = await fetch('/api/banners?position=home_top')
      if (!res.ok) throw new Error('Failed to fetch banners')
      const data = await res.json()
      if (data.success && data.data) {
        set({
          homeBanners: data.data.map((b: any) => ({
            id: b.id,
            title: b.title,
            image: b.image,
            link: b.link || '',
            position: b.position,
          }))
        })
      }
    } catch (error) {
      logger.warn({ component: 'data-fetch', err: error }, 'Failed to fetch home banners')
    }
  },
})
