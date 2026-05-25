import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product, ProductVariant } from '../types'

interface CartState {
  items: CartItem[]
  addItem: (product: Product, variant?: ProductVariant, quantity?: number) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  toggleCheck: (id: string) => void
  checkAll: (checked: boolean) => void
  clearCart: () => void
  getTotalPrice: () => number
  getCheckedTotalPrice: () => number
  getTotalItemCount: () => number
  getCheckedItemCount: () => number
  getCheckedItems: () => CartItem[]
  getCheckedTotal: () => number
  getCheckedCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, variant, quantity = 1) => set((state) => {
        const variantId = variant?.id
        const existing = state.items.find(
          (i) => i.productId === product.id && i.variantId === variantId
        )
        if (existing) {
          return {
            items: state.items.map((i) =>
              i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i
            ),
          }
        }
        return {
          items: [...state.items, {
            id: `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            productId: product.id,
            variantId: variantId || undefined,
            quantity,
            isChecked: true,
            product,
            variant: variant || undefined,
          }]
        }
      }),
      removeItem: (id) => set((state) => ({
        items: state.items.filter((i) => i.id !== id),
      })),
      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, quantity } : i
        ),
      })),
      toggleCheck: (id) => set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, isChecked: !i.isChecked } : i
        ),
      })),
      checkAll: (checked) => set((state) => ({
        items: state.items.map((i) => ({ ...i, isChecked: checked })),
      })),
      clearCart: () => set({ items: [] }),
      getTotalPrice: () =>
        get().items.reduce((sum, item) => {
          const basePrice = item.variant?.price || item.product.discountPrice || item.product.price
          return sum + basePrice * item.quantity
        }, 0),
      getCheckedTotalPrice: () =>
        get()
          .items.filter((i) => i.isChecked)
          .reduce((sum, item) => {
            const basePrice = item.variant?.price || item.product.discountPrice || item.product.price
            return sum + basePrice * item.quantity
          }, 0),
      getTotalItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      getCheckedItemCount: () =>
        get().items.filter((i) => i.isChecked).reduce((sum, item) => sum + item.quantity, 0),
      getCheckedItems: () => get().items.filter((i) => i.isChecked),
      getCheckedTotal: () =>
        get().items.filter((i) => i.isChecked)
          .reduce((sum, item) => {
            const basePrice = item.variant?.price || item.product.discountPrice || item.product.price
            return sum + basePrice * item.quantity
          }, 0),
      getCheckedCount: () =>
        get().items.filter((i) => i.isChecked).reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: 'martup-cart',
    }
  )
)
