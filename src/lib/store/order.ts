import type { StateCreator } from 'zustand'
import type { OrderSlice, AppStore } from './types'
import type { Order, OrderStatus } from '../types'
import { apiClient } from '@/lib/api-client'
import { mapOrder } from '../mappers'

// Type alias for API response (avoids TSX generic parsing issues)
type OrdersResponse = { success: boolean; data?: any[]; error?: string }

/**
 * Helper: take a full snapshot of relevant state for rollback.
 * Captures orders, wallet balance, wallet mutations, and seller balance
 * so that optimistic updates to any of these can be fully rolled back on failure.
 */
function snapshotState(state: AppStore): { orders: Order[]; walletBalance: number; walletMutations: any[]; sellerBalance: any } {
  return {
    orders: [...state.orders],
    walletBalance: state.walletBalance,
    walletMutations: [...state.walletMutations],
    sellerBalance: { ...state.sellerBalance },
  }
}

/**
 * Helper: restore all captured state from a snapshot.
 */
function restoreState(snapshot: ReturnType<typeof snapshotState>) {
  return {
    orders: snapshot.orders,
    walletBalance: snapshot.walletBalance,
    walletMutations: snapshot.walletMutations,
    sellerBalance: snapshot.sellerBalance,
  }
}

/**
 * Check if an order is a Cash on Delivery (COD) order.
 */
function isCodOrder(order: Order): boolean {
  const pm = order.paymentMethod?.toLowerCase() || ''
  const ps = order.paymentStatus?.toLowerCase() || ''
  return pm === 'cod' || pm.includes('bayar di tempat') || ps === 'cod'
}

export const createOrderSlice: StateCreator<AppStore, [], [], OrderSlice> = (set, get) => ({
  orders: [],
  isOrdersLoaded: false,

  // ==================== addOrder ====================
  // Local-only — the API call happens in checkout-screen.tsx
  addOrder: (order) => set((state) => {
    const sellerCredit = order.status === 'paid' ? order.subtotal * (1 - get().commissionRate) : 0
    const newSellerBalance = sellerCredit > 0
      ? {
          ...state.sellerBalance,
          pendingBalance: state.sellerBalance.pendingBalance + sellerCredit,
          totalBalance: state.sellerBalance.availableBalance + state.sellerBalance.pendingBalance + sellerCredit + state.sellerBalance.holdBalance,
        }
      : state.sellerBalance

    const updatedProducts = state.products.map(p => {
      const totalQty = order.items
        .filter(item => item.productId === p.id)
        .reduce((sum, item) => sum + item.quantity, 0)
      if (totalQty === 0) return p

      const newStock = Math.max(0, p.stock - totalQty)

      const updatedVariants = p.variants.map(v => {
        const variantItem = order.items.find(item => item.variantId === v.id)
        if (!variantItem) return v
        return { ...v, stock: Math.max(0, v.stock - variantItem.quantity) }
      })

      return { ...p, stock: Math.max(0, newStock), variants: updatedVariants }
    })

    return {
      orders: [order, ...state.orders],
      sellerBalance: newSellerBalance,
      products: updatedProducts,
    }
  }),

  // ==================== updateOrderStatus ====================
  // Optimistic update + API sync with rollback
  updateOrderStatus: async (orderId, status, options) => {
    const preSnapshot = snapshotState(get())

    // Optimistic update
    set((state) => {
      const order = state.orders.find(o => o.id === orderId)
      if (!order) return state
      const prevStatus = order.status
      const sellerCredit = order.subtotal * (1 - get().commissionRate)
      let newSellerBalance = { ...state.sellerBalance }

      if (status === 'paid' && prevStatus !== 'paid') {
        newSellerBalance.pendingBalance += sellerCredit
      } else if (status === 'delivered') {
        newSellerBalance.pendingBalance -= sellerCredit
        newSellerBalance.availableBalance += sellerCredit
      } else if (status === 'cancelled' && (prevStatus === 'paid' || prevStatus === 'processing' || prevStatus === 'shipped')) {
        newSellerBalance.pendingBalance -= sellerCredit
      }

      newSellerBalance.totalBalance = newSellerBalance.availableBalance + newSellerBalance.pendingBalance + newSellerBalance.holdBalance

      return {
        orders: state.orders.map(o => o.id === orderId ? {
          ...o, status,
          ...(status === 'paid' ? { paymentStatus: 'paid', paidAt: new Date().toISOString() } : {}),
          ...(status === 'shipped' ? { shippedAt: new Date().toISOString() } : {}),
          ...(status === 'delivered' ? { deliveredAt: new Date().toISOString() } : {}),
          ...(status === 'cancelled' ? { paymentStatus: 'refunded' } : {}),
        } : o),
        sellerBalance: newSellerBalance,
      }
    })

    // API call
    try {
      const body: Record<string, unknown> = { status }
      if (options?.trackingNumber) body.trackingNumber = options.trackingNumber
      if (options?.cancelReason) body.cancelReason = options.cancelReason
      if (status === 'cancelled' && !body.cancelReason) body.cancelReason = 'Dibatalkan oleh pengguna'
      if (status === 'shipped' && !body.trackingNumber) {
        // Try to use tracking from the local order's shipping data if available
        const localOrder = get().orders.find(o => o.id === orderId)
        if (localOrder?.shipping?.trackingNumber) {
          body.trackingNumber = localOrder.shipping.trackingNumber
        }
      }

      const res = await apiClient.rawPut(`/api/orders/${orderId}/status`, body)
      const data = await res.json()

      if (!res.ok || !data.success) {
        // Rollback on failure
        set(restoreState(preSnapshot))
        return
      }

      // On success: optionally update local state with server response
      if (data.data) {
        const serverOrder = mapOrder(data.data as unknown as Parameters<typeof mapOrder>[0])
        set((state) => ({
          orders: state.orders.map(o => o.id === orderId ? serverOrder : o),
        }))
      }
    } catch {
      // Rollback on network error
      set(restoreState(preSnapshot))
    }
  },

  // ==================== payForOrder ====================
  // Calls Midtrans for payment token or wallet deduction for wallet payments
  payForOrder: async (orderId) => {
    const preSnapshot = snapshotState(get())
    const order = get().orders.find(o => o.id === orderId)
    if (!order || order.status !== 'pending') return

    // COD orders don't need payment — reject the call
    const pm = order.paymentMethod?.toLowerCase() || ''
    const ps = order.paymentStatus?.toLowerCase() || ''
    if (pm === 'cod' || pm.includes('bayar di tempat') || ps === 'cod') {
      return { token: undefined, redirectUrl: undefined, error: 'Pesanan COD tidak memerlukan pembayaran online. Bayar saat barang diterima.' }
    }

    // API call: different flow based on payment method
    try {
      const paymentMethod = order.paymentMethod?.toLowerCase()

      if (paymentMethod === 'wallet') {
        // Wallet payment: use the wallet debit API, then update order status
        // Optimistic update for wallet payments (immediate confirmation expected)
        set((state) => {
          const currentOrder = state.orders.find(o => o.id === orderId)
          if (!currentOrder || currentOrder.status !== 'pending') return state
          if (currentOrder.totalAmount > state.walletBalance) return state

          const sellerCredit = currentOrder.subtotal * (1 - get().commissionRate)
          const newWalletBalance = state.walletBalance - currentOrder.totalAmount
          const newWalletMutations = [{
            id: `wm${Date.now()}`, type: 'debit' as const, amount: currentOrder.totalAmount, balance: newWalletBalance,
            description: `Pembayaran Order #${currentOrder.orderNumber}`, refType: 'order', createdAt: new Date().toISOString()
          }, ...state.walletMutations]
          const newSellerBalance = {
            ...state.sellerBalance,
            pendingBalance: state.sellerBalance.pendingBalance + sellerCredit,
            totalBalance: state.sellerBalance.availableBalance + state.sellerBalance.pendingBalance + sellerCredit + state.sellerBalance.holdBalance,
          }

          return {
            orders: state.orders.map(o => o.id === orderId ? {
              ...o, status: 'paid' as OrderStatus, paymentStatus: 'paid', paidAt: new Date().toISOString(),
            } : o),
            walletBalance: newWalletBalance,
            walletMutations: newWalletMutations,
            sellerBalance: newSellerBalance,
          }
        })

        try {
          // Use the proper wallet debit endpoint
          const debitRes = await apiClient.rawPost('/api/wallet/debit', {
            orderId: order.id,
            amount: order.totalAmount,
            description: `Pembayaran pesanan via MartUp Pay`,
          })
          const debitData = await debitRes.json()

          if (!debitRes.ok || !debitData.success) {
            // Wallet debit failed — rollback optimistic update
            set(restoreState(preSnapshot))
            return { token: undefined, redirectUrl: undefined, error: debitData.error || 'Saldo tidak mencukupi atau gagal memproses pembayaran wallet.' }
          }
        } catch {
          // Wallet debit API failed — rollback
          set(restoreState(preSnapshot))
          return { token: undefined, redirectUrl: undefined, error: 'Gagal memproses pembayaran wallet. Silakan coba lagi.' }
        }

        // Update order status to paid via the status API
        // Note: Only admin can set status to 'paid', but wallet debit endpoint
        // should already handle order status update internally.
        // Try updating status as a fallback.
        try {
          const statusRes = await apiClient.rawPut(`/api/orders/${orderId}/status`, { status: 'paid' })
          if (statusRes.ok) {
            const statusData = await statusRes.json()
            if (statusData.success && statusData.data) {
              const serverOrder = mapOrder(statusData.data as unknown as Parameters<typeof mapOrder>[0])
              set((state) => ({
                orders: state.orders.map(o => o.id === orderId ? serverOrder : o),
              }))
            }
          } else {
            // Status update failed (likely non-admin) — wallet debit may have already handled it
            // Re-fetch orders to get current server state
            const userId = get().currentUser?.id
            if (userId) {
              try {
                const data = await apiClient.get<OrdersResponse>('/api/orders', { userId })
                if (data.success && Array.isArray(data.data)) {
                  const serverOrders = data.data.map((raw: Record<string, unknown>) => mapOrder(raw as unknown as Parameters<typeof mapOrder>[0]))
                  set({ orders: serverOrders })
                }
              } catch { /* non-critical */ }
            }
          }
        } catch {
          // Non-critical — wallet debit already processed
        }

        return { token: undefined, redirectUrl: undefined }
      }

      // Midtrans / card / other payment: create payment token
      // NO optimistic update for Midtrans — payment is not confirmed until webhook
      const res = await apiClient.rawPost('/api/payment/create', { orderId })
      const data = await res.json()

      if (!res.ok || !data.success) {
        // Payment creation failed — no rollback needed since we didn't do optimistic update
        return { token: undefined, redirectUrl: undefined, error: data.error || 'Gagal memproses pembayaran' }
      }

      // Return the payment token for the UI to use (open Midtrans Snap popup)
      // The order stays 'pending' until Midtrans webhook confirms payment
      return {
        token: data.data?.token,
        redirectUrl: data.data?.redirectUrl,
      }
    } catch {
      // Rollback on network error (only if we did optimistic update for wallet)
      if (pm === 'wallet') {
        set(restoreState(preSnapshot))
      }
      return { token: undefined, redirectUrl: undefined, error: 'Kesalahan jaringan. Silakan coba lagi.' }
    }
  },

  // ==================== cancelOrder ====================
  // Optimistic update + API call with rollback
  cancelOrder: async (orderId) => {
    const preSnapshot = snapshotState(get())

    // Optimistic update
    set((state) => {
      const order = state.orders.find(o => o.id === orderId)
      if (!order) return state

      const wasPaid = !isCodOrder(order) && (order.paymentStatus === 'paid' || order.status === 'paid' || order.status === 'processing' || order.status === 'shipped')
      const sellerCredit = order.subtotal * (1 - get().commissionRate)

      let newSellerBalance = { ...state.sellerBalance }
      let newWalletBalance = state.walletBalance
      let newWalletMutations = [...state.walletMutations]

      if (wasPaid) {
        newSellerBalance.pendingBalance -= sellerCredit
      }

      if (order.paymentMethod?.toLowerCase() === 'wallet' && wasPaid) {
        newWalletBalance = state.walletBalance + order.totalAmount
        newWalletMutations = [{
          id: `wm${Date.now()}`, type: 'credit' as const, amount: order.totalAmount, balance: newWalletBalance,
          description: `Refund Order #${order.orderNumber}`, refType: 'refund', createdAt: new Date().toISOString()
        }, ...state.walletMutations]
      }

      newSellerBalance.totalBalance = newSellerBalance.availableBalance + newSellerBalance.pendingBalance + newSellerBalance.holdBalance

      return {
        orders: state.orders.map(o => o.id === orderId ? {
          ...o, status: 'cancelled' as OrderStatus, paymentStatus: 'refunded',
        } : o),
        sellerBalance: newSellerBalance,
        walletBalance: newWalletBalance,
        walletMutations: newWalletMutations,
      }
    })

    // API call
    try {
      const res = await apiClient.rawPut(`/api/orders/${orderId}/status`, {
        status: 'cancelled',
        cancelReason: 'Dibatalkan oleh pembeli',
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        // Rollback on failure
        set(restoreState(preSnapshot))
        return
      }

      // On success: update with server response
      if (data.data) {
        const serverOrder = mapOrder(data.data as unknown as Parameters<typeof mapOrder>[0])
        set((state) => ({
          orders: state.orders.map(o => o.id === orderId ? serverOrder : o),
        }))
      }
    } catch {
      // Rollback on network error
      set(restoreState(preSnapshot))
    }
  },

  // ==================== updateOrderTracking ====================
  // Optimistic update + API call with rollback
  updateOrderTracking: async (orderId, trackingNumber) => {
    const preSnapshot = snapshotState(get())

    // Optimistic update
    set((state) => ({
      orders: state.orders.map(o => o.id === orderId ? {
        ...o,
        shipping: o.shipping ? { ...o.shipping, trackingNumber } : undefined,
      } : o),
    }))

    // API call: use the status endpoint with shipped + trackingNumber
    try {
      const res = await apiClient.rawPut(`/api/orders/${orderId}/status`, {
        status: 'shipped',
        trackingNumber,
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        // Rollback on failure
        set(restoreState(preSnapshot))
        return
      }

      // On success: update with server response
      if (data.data) {
        const serverOrder = mapOrder(data.data as unknown as Parameters<typeof mapOrder>[0])
        set((state) => ({
          orders: state.orders.map(o => o.id === orderId ? serverOrder : o),
        }))
      }
    } catch {
      // Rollback on network error
      set(restoreState(preSnapshot))
    }
  },

  // ==================== updateOrderPaymentStatus ====================
  updateOrderPaymentStatus: (orderId, paymentStatus) => set((state) => ({
    orders: state.orders.map(o => o.id === orderId ? { ...o, paymentStatus } : o),
  })),

  // ==================== fetchOrders ====================
  // Fetch orders from the server and replace local state
  fetchOrders: async (userId) => {
    try {
      const data = await apiClient.get<OrdersResponse>('/api/orders', { userId })

      if (data.success && Array.isArray(data.data)) {
        const serverOrders = data.data.map((raw: Record<string, unknown>) => mapOrder(raw as unknown as Parameters<typeof mapOrder>[0]))
        set({
          orders: serverOrders,
          isOrdersLoaded: true,
        })
      } else {
        // Even on failure, mark as loaded (we tried)
        set({ isOrdersLoaded: true })
      }
    } catch {
      // Even on failure, mark as loaded (we tried)
      set({ isOrdersLoaded: true })
    }
  },
})
