import type { StateCreator } from 'zustand'
import type { OrderSlice, AppStore } from './types'
import type { OrderStatus } from '../types'

export const createOrderSlice: StateCreator<AppStore, [], [], OrderSlice> = (set, get) => ({
  orders: [],
  addOrder: (order) => set((state) => {
    const sellerCredit = order.status === 'paid' ? order.subtotal * 0.95 : 0
    const newSellerBalance = sellerCredit > 0
      ? {
          ...state.sellerBalance,
          pendingBalance: state.sellerBalance.pendingBalance + sellerCredit,
          totalBalance: state.sellerBalance.availableBalance + state.sellerBalance.pendingBalance + sellerCredit + state.sellerBalance.holdBalance,
        }
      : state.sellerBalance

    const updatedProducts = state.products.map(p => {
      // Sum all quantities for this product (may have multiple variants)
      const totalQty = order.items
        .filter(item => item.productId === p.id)
        .reduce((sum, item) => sum + item.quantity, 0)
      if (totalQty === 0) return p

      const newStock = Math.max(0, p.stock - totalQty)

      const updatedVariants = p.variants.map(v => {
        const variantItem = order.items.find(item => item.variantId === v.id)
        if (!variantItem) return v
        return { ...v, stock: v.stock - variantItem.quantity }
      })

      return { ...p, stock: Math.max(0, newStock), variants: updatedVariants }
    })

    return {
      orders: [order, ...state.orders],
      sellerBalance: newSellerBalance,
      products: updatedProducts,
    }
  }),
  updateOrderStatus: (orderId, status) => set((state) => {
    const order = state.orders.find(o => o.id === orderId)
    if (!order) return state
    const prevStatus = order.status
    const sellerCredit = order.subtotal * 0.95
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
      } : o),
      sellerBalance: newSellerBalance,
    }
  }),
  payForOrder: (orderId) => set((state) => {
    const order = state.orders.find(o => o.id === orderId)
    if (!order || order.status !== 'pending') return state

    const sellerCredit = order.subtotal * 0.95
    let newWalletBalance = state.walletBalance
    let newWalletMutations = [...state.walletMutations]

    if (order.paymentMethod?.toLowerCase() === 'wallet') {
      if (order.totalAmount > state.walletBalance) return state
      newWalletBalance = state.walletBalance - order.totalAmount
      newWalletMutations = [{
        id: `wm${Date.now()}`, type: 'debit' as const, amount: order.totalAmount, balance: newWalletBalance,
        description: `Pembayaran Order #${order.orderNumber}`, refType: 'order', createdAt: new Date().toISOString()
      }, ...state.walletMutations]
    }

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
  }),
  cancelOrder: (orderId) => set((state) => {
    const order = state.orders.find(o => o.id === orderId)
    if (!order) return state

    const wasPaid = order.paymentStatus === 'paid' || order.status === 'paid' || order.status === 'processing' || order.status === 'shipped'
    const sellerCredit = order.subtotal * 0.95

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
  }),
  updateOrderTracking: (orderId, trackingNumber) => set((state) => ({
    orders: state.orders.map(o => o.id === orderId ? {
      ...o,
      shipping: o.shipping ? { ...o.shipping, trackingNumber } : undefined,
    } : o),
  })),
})
