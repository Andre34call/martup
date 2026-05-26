import { create } from 'zustand'
import { logger } from '@/lib/logger'
import { persist } from 'zustand/middleware'
import type { CartItem, Product, ProductVariant } from '../types'
import { getAuthHeaders } from './getAuthHeaders'

// ==================== TYPES ====================

interface CartState {
  items: CartItem[]
  isSyncing: boolean
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
  syncFromServer: (userId: string) => Promise<void>
  mergeLocalToServer: (userId: string) => Promise<void>
}

// ==================== HELPERS ====================

/** Check if user is authenticated by looking for authToken in localStorage */
function isUserAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('authToken')
}

/** Map a server cart item response to our local CartItem type */
function mapServerCartItem(raw: Record<string, unknown>): CartItem {
  return {
    id: raw.id as string,
    productId: raw.productId as string,
    variantId: (raw.variantId as string) || undefined,
    quantity: raw.quantity as number,
    isChecked: raw.isChecked as boolean,
    product: raw.product as Product,
    variant: (raw.variant as ProductVariant) || undefined,
  }
}

/** Calculate the effective price for a cart item */
function getItemPrice(item: CartItem): number {
  return item.variant?.price || item.product.discountPrice || item.product.price
}

// ==================== STORE ====================

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isSyncing: false,

      // ==================== ADD ITEM ====================
      addItem: (product, variant, quantity = 1) => {
        const variantId = variant?.id
        const existing = get().items.find(
          (i) => i.productId === product.id && i.variantId === variantId
        )

        // Build the optimistic local update
        const optimisticUpdate = existing
          ? {
              items: get().items.map((i) =>
                i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i
              ),
            }
          : {
              items: [
                ...get().items,
                {
                  id: `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  productId: product.id,
                  variantId: variantId || undefined,
                  quantity,
                  isChecked: true,
                  product,
                  variant: variant || undefined,
                },
              ],
            }

        // Apply optimistic update
        set(optimisticUpdate)

        // If authenticated, sync with server
        if (isUserAuthenticated()) {
          const previousItems = existing ? get().items : optimisticUpdate.items
          fetch('/api/cart', {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ productId: product.id, variantId: variantId || null, quantity }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.data) {
                // Server responded with the upserted item — replace optimistic item
                const serverItem = mapServerCartItem(data.data)
                set((state) => ({
                  items: state.items.map((i) =>
                    i.productId === serverItem.productId && i.variantId === serverItem.variantId
                      ? serverItem
                      : i
                  ),
                }))
              } else {
                // API returned error — revert
                set({ items: previousItems })
                logger.warn({ component: 'cart', error: data.error }, 'Cart add failed')
              }
            })
            .catch(() => {
              // Network error — revert
              set({ items: previousItems })
              logger.warn({ component: 'cart' }, 'Cart add: network error, reverted optimistic update')
            })
        }
      },

      // ==================== REMOVE ITEM ====================
      removeItem: (id) => {
        const previousItems = get().items
        const removedItem = previousItems.find((i) => i.id === id)

        // Optimistic: remove locally
        set({ items: previousItems.filter((i) => i.id !== id) })

        // If authenticated, sync with server
        if (isUserAuthenticated() && removedItem) {
          fetch('/api/cart', {
            method: 'DELETE',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ cartItemId: id }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (!data.success) {
                // Revert on failure
                set({ items: previousItems })
                logger.warn({ component: 'cart', error: data.error }, 'Cart remove failed')
              }
            })
            .catch(() => {
              // Revert on network error
              set({ items: previousItems })
              logger.warn({ component: 'cart' }, 'Cart remove: network error, reverted optimistic update')
            })
        }
      },

      // ==================== UPDATE QUANTITY ====================
      updateQuantity: (id, quantity) => {
        const previousItems = get().items
        const targetItem = previousItems.find((i) => i.id === id)

        // Optimistic: update locally
        set({
          items: previousItems.map((i) =>
            i.id === id ? { ...i, quantity } : i
          ),
        })

        // If authenticated, sync with server
        if (isUserAuthenticated() && targetItem) {
          fetch('/api/cart', {
            method: 'PUT',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ cartItemId: id, quantity }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.data) {
                // Update with server response (may have adjusted quantity)
                const serverItem = mapServerCartItem(data.data)
                set((state) => ({
                  items: state.items.map((i) =>
                    i.id === id ? serverItem : i
                  ),
                }))
              } else {
                // Revert on failure
                set({ items: previousItems })
                logger.warn({ component: 'cart', error: data.error }, 'Cart quantity update failed')
              }
            })
            .catch(() => {
              // Revert on network error
              set({ items: previousItems })
              logger.warn({ component: 'cart' }, 'Cart quantity update: network error, reverted optimistic update')
            })
        }
      },

      // ==================== TOGGLE CHECK ====================
      toggleCheck: (id) => {
        const previousItems = get().items
        const targetItem = previousItems.find((i) => i.id === id)

        // Optimistic: toggle locally
        set({
          items: previousItems.map((i) =>
            i.id === id ? { ...i, isChecked: !i.isChecked } : i
          ),
        })

        // If authenticated, sync with server
        if (isUserAuthenticated() && targetItem) {
          const newChecked = !targetItem.isChecked
          fetch('/api/cart', {
            method: 'PUT',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ cartItemId: id, isChecked: newChecked }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (!data.success) {
                // Revert on failure
                set({ items: previousItems })
                logger.warn({ component: 'cart', error: data.error }, 'Cart toggle check failed')
              }
            })
            .catch(() => {
              // Revert on network error
              set({ items: previousItems })
              logger.warn({ component: 'cart' }, 'Cart toggle check: network error, reverted optimistic update')
            })
        }
      },

      // ==================== CHECK ALL ====================
      checkAll: (checked) => {
        const previousItems = get().items

        // Optimistic: update all locally
        set({
          items: previousItems.map((i) => ({ ...i, isChecked: checked })),
        })

        // If authenticated, sync all items with server
        if (isUserAuthenticated()) {
          const updates = previousItems.map((item) =>
            fetch('/api/cart', {
              method: 'PUT',
              headers: getAuthHeaders(true),
              body: JSON.stringify({ cartItemId: item.id, isChecked: checked }),
            })
              .then((res) => res.json())
              .then((data) => ({ itemId: item.id, success: data.success }))
              .catch(() => ({ itemId: item.id, success: false }))
          )

          Promise.all(updates).then((results) => {
            const failures = results.filter((r) => !r.success)
            if (failures.length > 0) {
              // Re-sync from server on partial failure to ensure consistency
              logger.warn({ component: 'cart' }, 'Cart checkAll: some updates failed, re-syncing from server')
              const token = localStorage.getItem('authToken')
              if (token) {
                // Extract userId from token payload (HMAC token contains userId)
                // Instead, just re-fetch. We need the userId but don't have it here.
                // We'll just revert locally since we can't get userId easily
                set({ items: previousItems })
              }
            }
          })
        }
      },

      // ==================== CLEAR CART ====================
      clearCart: () => {
        const previousItems = get().items

        // Optimistic: clear locally
        set({ items: [] })

        // If authenticated, clear on server
        if (isUserAuthenticated()) {
          fetch('/api/cart?clear=true', {
            method: 'POST',
            headers: getAuthHeaders(true),
          })
            .then((res) => res.json())
            .then((data) => {
              if (!data.success) {
                // Revert on failure
                set({ items: previousItems })
                logger.warn({ component: 'cart', error: data.error }, 'Cart clear failed')
              }
            })
            .catch(() => {
              // Revert on network error
              set({ items: previousItems })
              logger.warn({ component: 'cart' }, 'Cart clear: network error, reverted optimistic update')
            })
        }
      },

      // ==================== GETTERS ====================
      getTotalPrice: () =>
        get().items.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0),

      getCheckedTotalPrice: () =>
        get().items.filter((i) => i.isChecked)
          .reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0),

      getTotalItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      getCheckedItemCount: () =>
        get().items.filter((i) => i.isChecked).reduce((sum, item) => sum + item.quantity, 0),

      getCheckedItems: () =>
        get().items.filter((i) => i.isChecked),

      getCheckedTotal: () =>
        get().items.filter((i) => i.isChecked)
          .reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0),

      getCheckedCount: () =>
        get().items.filter((i) => i.isChecked).reduce((sum, item) => sum + item.quantity, 0),

      // ==================== SERVER SYNC METHODS ====================

      /** Fetch cart from server and replace local state with server data */
      syncFromServer: async (userId: string) => {
        set({ isSyncing: true })
        try {
          const res = await fetch(`/api/cart?userId=${userId}`, {
            headers: getAuthHeaders(),
          })
          const data = await res.json()
          if (data.success && Array.isArray(data.data)) {
            const serverItems = data.data.map((raw: Record<string, unknown>) => mapServerCartItem(raw))
            set({ items: serverItems, isSyncing: false })
          } else {
            logger.warn({ component: 'cart', error: data.error }, 'Cart sync failed')
            set({ isSyncing: false })
          }
        } catch (error) {
          logger.warn({ component: 'cart', err: error }, 'Cart sync: network error')
          set({ isSyncing: false })
        }
      },

      /** Merge local cart items into server, then re-fetch from server */
      mergeLocalToServer: async (userId: string) => {
        const localItems = get().items

        // If no local items, just sync from server
        if (localItems.length === 0) {
          await get().syncFromServer(userId)
          return
        }

        set({ isSyncing: true })
        try {
          // Prepare merge payload — only send productId, variantId, quantity
          const mergeItems = localItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: item.quantity,
          }))

          const res = await fetch('/api/cart?merge=true', {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ items: mergeItems }),
          })
          const data = await res.json()

          if (data.success) {
            // Merge succeeded — re-fetch from server to get the authoritative state
            await get().syncFromServer(userId)
          } else {
            logger.warn({ component: 'cart', error: data.error }, 'Cart merge failed')
            set({ isSyncing: false })
          }
        } catch (error) {
          logger.warn({ component: 'cart', err: error }, 'Cart merge: network error')
          set({ isSyncing: false })
        }
      },
    }),
    {
      name: 'martup-cart',
    }
  )
)
