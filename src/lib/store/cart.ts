import { create } from 'zustand'
import { logger } from '@/lib/logger'
import { persist } from 'zustand/middleware'
import type { CartItem, Product, ProductVariant } from '../types'
import { apiClient } from '@/lib/api-client'

// ==================== TYPES ====================

// Type alias for API response (avoids TSX generic parsing issues)
type CartSyncResponse = { success: boolean; data?: any[]; error?: string }

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

/** Check if user is authenticated by looking for auth flag cookie */
function isUserAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return document.cookie.split(';').some(c => c.trim().startsWith('martup_auth='))
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
  return item.variant?.price ?? item.product.discountPrice ?? item.product.price
}

// ==================== MODULE-LEVEL INFRASTRUCTURE ====================

/**
 * Mutation queue: ensures API calls execute sequentially to prevent race conditions.
 * Each enqueued function returns a Promise; the chain resolves them one at a time.
 */
let mutationQueue: Promise<void> = Promise.resolve()

function enqueueMutation(fn: () => Promise<void>): void {
  mutationQueue = mutationQueue.then(fn).catch((err) => {
    logger.warn({ component: 'cart', err }, 'Mutation queue error')
  })
}

/**
 * Debounce map for quantity updates.
 * Key = cartItemId, Value = timeout handle.
 * When a quantity update comes in, we clear the previous pending call and set a new one.
 */
const quantityDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const DEBOUNCE_DELAY_MS = 500

/** Re-sync cart from server and replace local state. Used as the error recovery path. */
async function resyncFromServer(set: (partial: Partial<CartState> | ((state: CartState) => Partial<CartState>)) => void): Promise<void> {
  try {
    const data = await apiClient.get<CartSyncResponse>('/api/cart')
    if (data.success && Array.isArray(data.data)) {
      const serverItems = data.data.map((raw: Record<string, unknown>) => mapServerCartItem(raw))
      set({ items: serverItems, isSyncing: false })
    } else {
      set({ isSyncing: false })
    }
  } catch {
    set({ isSyncing: false })
  }
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

        // Optimistic update using functional state (no stale capture)
        set((state) => {
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
            items: [
              ...state.items,
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
        })

        // If authenticated, queue the API call
        if (isUserAuthenticated()) {
          enqueueMutation(async () => {
            try {
              const res = await apiClient.rawPost('/api/cart', { productId: product.id, variantId: variantId || null, quantity })
              const data = await res.json()
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
                // API error — re-sync from server instead of stale rollback
                logger.warn({ component: 'cart', error: data.error }, 'Cart add failed, re-syncing')
                await resyncFromServer(set)
              }
            } catch {
              // Network error — re-sync from server instead of stale rollback
              logger.warn({ component: 'cart' }, 'Cart add: network error, re-syncing from server')
              await resyncFromServer(set)
            }
          })
        }
      },

      // ==================== REMOVE ITEM ====================
      removeItem: (id) => {
        // Optimistic: remove locally using functional update
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }))

        // If authenticated, queue the API call using /api/cart/[id] (BUG 5 fix)
        if (isUserAuthenticated()) {
          enqueueMutation(async () => {
            try {
              const res = await apiClient.rawDelete(`/api/cart/${encodeURIComponent(id)}`)
              const data = await res.json()
              if (!data.success) {
                // Re-sync from server on failure
                logger.warn({ component: 'cart', error: data.error }, 'Cart remove failed, re-syncing')
                await resyncFromServer(set)
              }
            } catch {
              // Re-sync from server on network error
              logger.warn({ component: 'cart' }, 'Cart remove: network error, re-syncing from server')
              await resyncFromServer(set)
            }
          })
        }
      },

      // ==================== UPDATE QUANTITY ====================
      updateQuantity: (id, quantity) => {
        // Optimistic: update locally using functional update
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, quantity } : i
          ),
        }))

        // If authenticated, debounce the server sync (BUG 2 fix)
        if (isUserAuthenticated()) {
          // Clear any existing pending debounce for this item
          const existingTimer = quantityDebounceTimers.get(id)
          if (existingTimer) {
            clearTimeout(existingTimer)
          }

          // Set a new debounced call
          const timer = setTimeout(() => {
            quantityDebounceTimers.delete(id)
            enqueueMutation(async () => {
              try {
                const res = await apiClient.rawPut(`/api/cart/${encodeURIComponent(id)}`, { quantity })
                const data = await res.json()
                if (data.success && data.data) {
                  // Update with server response (may have adjusted quantity due to stock limits)
                  const serverItem = mapServerCartItem(data.data)
                  set((state) => ({
                    items: state.items.map((i) =>
                      i.id === id ? serverItem : i
                    ),
                  }))
                } else {
                  // Re-sync from server on failure
                  logger.warn({ component: 'cart', error: data.error }, 'Cart quantity update failed, re-syncing')
                  await resyncFromServer(set)
                }
              } catch {
                // Re-sync from server on network error
                logger.warn({ component: 'cart' }, 'Cart quantity update: network error, re-syncing from server')
                await resyncFromServer(set)
              }
            })
          }, DEBOUNCE_DELAY_MS)

          quantityDebounceTimers.set(id, timer)
        }
      },

      // ==================== TOGGLE CHECK ====================
      toggleCheck: (id) => {
        // Optimistic: toggle locally using functional update
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, isChecked: !i.isChecked } : i
          ),
        }))

        // If authenticated, queue the API call
        if (isUserAuthenticated()) {
          // Read the new checked value from current state
          const currentItem = get().items.find((i) => i.id === id)
          if (!currentItem) return
          const newChecked = currentItem.isChecked

          enqueueMutation(async () => {
            try {
              const res = await apiClient.rawPut(`/api/cart/${encodeURIComponent(id)}`, { isChecked: newChecked })
              const data = await res.json()
              if (!data.success) {
                // Re-sync from server on failure
                logger.warn({ component: 'cart', error: data.error }, 'Cart toggle check failed, re-syncing')
                await resyncFromServer(set)
              }
            } catch {
              // Re-sync from server on network error
              logger.warn({ component: 'cart' }, 'Cart toggle check: network error, re-syncing from server')
              await resyncFromServer(set)
            }
          })
        }
      },

      // ==================== CHECK ALL ====================
      checkAll: (checked) => {
        // Optimistic: update all locally using functional update
        set((state) => ({
          items: state.items.map((i) => ({ ...i, isChecked: checked })),
        }))

        // If authenticated, use bulk endpoint (BUG 4 fix)
        if (isUserAuthenticated()) {
          const currentItems = get().items
          if (currentItems.length === 0) return

          const bulkItems = currentItems.map((item) => ({
            cartItemId: item.id,
            isChecked: checked,
          }))

          enqueueMutation(async () => {
            try {
              const res = await apiClient.rawPut('/api/cart/bulk', { items: bulkItems })
              const data = await res.json()
              if (data.success && Array.isArray(data.data)) {
                // Replace with server-confirmed items
                const serverItems = data.data.map((raw: Record<string, unknown>) => mapServerCartItem(raw))
                set({ items: serverItems })
              } else {
                // Re-sync from server on failure
                logger.warn({ component: 'cart', error: data.error }, 'Cart checkAll bulk failed, re-syncing')
                await resyncFromServer(set)
              }
            } catch {
              // Re-sync from server on network error
              logger.warn({ component: 'cart' }, 'Cart checkAll: network error, re-syncing from server')
              await resyncFromServer(set)
            }
          })
        }
      },

      // ==================== CLEAR CART ====================
      clearCart: () => {
        // Optimistic: clear locally using functional update
        set((state) => ({
          items: state.items.length > 0 ? [] : state.items,
        }))

        // If authenticated, clear on server
        if (isUserAuthenticated()) {
          enqueueMutation(async () => {
            try {
              const res = await apiClient.rawPost('/api/cart?clear=true', undefined)
              const data = await res.json()
              if (!data.success) {
                // Re-sync from server on failure
                logger.warn({ component: 'cart', error: data.error }, 'Cart clear failed, re-syncing')
                await resyncFromServer(set)
              }
            } catch {
              // Re-sync from server on network error
              logger.warn({ component: 'cart' }, 'Cart clear: network error, re-syncing from server')
              await resyncFromServer(set)
            }
          })
        }
      },

      // ==================== GETTERS ====================
      getTotalPrice: () =>
        get().items.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0),

      getCheckedTotalPrice: () => get().getCheckedTotal(),

      getTotalItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      getCheckedItemCount: () => get().getCheckedCount(),

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
          const data = await apiClient.get<CartSyncResponse>('/api/cart', { userId })
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
          // First, fetch the server cart to identify which items already exist
          const serverRes = await apiClient.get<CartSyncResponse>('/api/cart', { userId })

          if (serverRes.success && Array.isArray(serverRes.data)) {
            const serverItems = serverRes.data.map((raw: Record<string, unknown>) => mapServerCartItem(raw))

            // Only merge items that DON'T exist on the server (genuinely new local additions)
            const newItems = localItems.filter(localItem =>
              !serverItems.some(serverItem =>
                serverItem.productId === localItem.productId &&
                serverItem.variantId === (localItem.variantId || null)
              )
            )

            if (newItems.length > 0) {
              const mergeItems = newItems.map((item) => ({
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: item.quantity,
              }))
              await apiClient.rawPost('/api/cart?merge=true', { items: mergeItems })
            }

            // BUG 3 fix: Re-fetch from server AFTER the merge to get the complete post-merge state
            // (The previous serverItems was fetched BEFORE the merge, so it doesn't include merged items)
            const postMergeRes = await apiClient.get<CartSyncResponse>('/api/cart', { userId })
            if (postMergeRes.success && Array.isArray(postMergeRes.data)) {
              const postMergeItems = postMergeRes.data.map((raw: Record<string, unknown>) => mapServerCartItem(raw))
              set({ items: postMergeItems, isSyncing: false })
            } else {
              // Fallback to pre-merge server items if re-fetch fails
              set({ items: serverItems, isSyncing: false })
            }
          } else {
            // Fallback: no server data, just sync from server
            await get().syncFromServer(userId)
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
