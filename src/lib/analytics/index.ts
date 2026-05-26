// ==================== ANALYTICS TRACKING ====================
// Client-side analytics event tracking.
// Events are sent to /api/analytics/track and logged server-side.
// This works alongside Vercel Analytics for page views.

export interface AnalyticsEvent {
  name: string
  properties?: Record<string, string | number | boolean | null>
  userId?: string
}

// Queue for batching events
let eventQueue: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
const FLUSH_INTERVAL = 5000 // 5 seconds
const MAX_QUEUE_SIZE = 20

/**
 * Track an analytics event.
 * Events are batched and sent periodically to reduce API calls.
 */
export function trackEvent(name: string, properties?: AnalyticsEvent['properties']): void {
  // Don't track in SSR
  if (typeof window === 'undefined') return

  const event: AnalyticsEvent = {
    name,
    properties,
    userId: undefined, // Will be set server-side from auth
  }

  eventQueue.push(event)

  // Flush immediately if queue is full
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushEvents()
    return
  }

  // Schedule a flush if not already scheduled
  if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL)
  }
}

/**
 * Track a page view.
 */
export function trackPageView(path: string, title?: string): void {
  trackEvent('page_view', {
    path,
    title: title || (typeof document !== 'undefined' ? document.title : ''),
    referrer: typeof document !== 'undefined' ? document.referrer : '',
  })
}

/**
 * Track an e-commerce event.
 */
export const ecommerce = {
  productViewed(productId: string, productName: string, price: number) {
    trackEvent('product_viewed', { productId, productName, price })
  },
  productAddedToCart(productId: string, quantity: number, price: number) {
    trackEvent('product_added_to_cart', { productId, quantity, price })
  },
  productRemovedFromCart(productId: string, quantity: number) {
    trackEvent('product_removed_from_cart', { productId, quantity })
  },
  checkoutStarted(totalAmount: number, itemCount: number) {
    trackEvent('checkout_started', { totalAmount, itemCount })
  },
  orderPlaced(orderId: string, totalAmount: number, paymentMethod: string) {
    trackEvent('order_placed', { orderId, totalAmount, paymentMethod })
  },
  orderPaid(orderId: string, totalAmount: number) {
    trackEvent('order_paid', { orderId, totalAmount })
  },
  paymentFailed(orderId: string, reason: string) {
    trackEvent('payment_failed', { orderId, reason })
  },
  searchPerformed(query: string, resultCount: number) {
    trackEvent('search_performed', { query, resultCount })
  },
  wishlistAdded(productId: string) {
    trackEvent('wishlist_added', { productId })
  },
  reviewSubmitted(productId: string, rating: number) {
    trackEvent('review_submitted', { productId, rating })
  },
  sellerRegistered(sellerId: string, storeName: string) {
    trackEvent('seller_registered', { sellerId, storeName })
  },
  withdrawalRequested(amount: number, bankName: string) {
    trackEvent('withdrawal_requested', { amount, bankName })
  },
}

/**
 * Flush queued events to the server.
 */
async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return

  // Take events from queue
  const events = [...eventQueue]
  eventQueue = []

  // Clear the timer
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  try {
    // Get CSRF token from cookie
    const csrfToken = getCookie('__Host-csrf-token')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }

    await fetch('/api/analytics/track', {
      method: 'POST',
      headers,
      body: JSON.stringify({ events }),
      keepalive: true, // Ensure request completes even if page unloads
    })
  } catch {
    // Silently fail — analytics should never break the app
  }
}

/**
 * Get a cookie value by name.
 */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : undefined
}

// Flush remaining events on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (eventQueue.length > 0) {
      // Use sendBeacon for reliability during page unload
      const csrfToken = getCookie('__Host-csrf-token')
      const payload = JSON.stringify({ events: eventQueue })
      const blob = new Blob([payload], { type: 'application/json' })
      // sendBeacon doesn't support custom headers, but analytics is best-effort
      navigator.sendBeacon('/api/analytics/track?csrf=' + encodeURIComponent(csrfToken || ''), blob)
      eventQueue = []
    }
  })
}
