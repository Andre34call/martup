// ==================== Midtrans Snap Integration ====================
// Loads the Midtrans Snap.js script and provides a promise-based API
// for opening the Snap payment popup.

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: SnapPayOptions) => void
    }
  }
}

interface SnapPayOptions {
  onSuccess?: (result: SnapResult) => void
  onPending?: (result: SnapResult) => void
  onError?: (result: SnapResult) => void
  onClose?: () => void
}

interface SnapResult {
  status_code: string
  transaction_status: string
  order_id: string
  payment_type: string
  gross_amount: string
  [key: string]: unknown
}

let snapLoaded = false
let snapLoading: Promise<void> | null = null

/**
 * Get the Midtrans Snap.js URL based on environment.
 */
function getSnapUrl(): string {
  const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
  return isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js'
}

/**
 * Load the Midtrans Snap.js script (only once).
 * Includes the client key as a data attribute.
 */
export function loadSnapScript(): Promise<void> {
  if (snapLoaded && window.snap) return Promise.resolve()
  if (snapLoading) return snapLoading

  snapLoading = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-client-key]')
    if (existingScript && window.snap) {
      snapLoaded = true
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = getSnapUrl()
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '')
    script.async = true
    script.onload = () => {
      snapLoaded = true
      resolve()
    }
    script.onerror = () => {
      snapLoading = null
      reject(new Error('Failed to load Midtrans Snap.js'))
    }
    document.head.appendChild(script)
  })

  return snapLoading
}

/**
 * Open the Midtrans Snap payment popup.
 * Returns a promise that resolves when payment is completed or rejected.
 */
export async function openSnapPayment(
  snapToken: string,
): Promise<{ status: 'success' | 'pending' | 'error' | 'closed'; result?: SnapResult }> {
  await loadSnapScript()

  if (!window.snap) {
    throw new Error('Midtrans Snap is not loaded')
  }

  return new Promise((resolve) => {
    window.snap!.pay(snapToken, {
      onSuccess: (result) => {
        resolve({ status: 'success', result })
      },
      onPending: (result) => {
        resolve({ status: 'pending', result })
      },
      onError: (result) => {
        resolve({ status: 'error', result })
      },
      onClose: () => {
        resolve({ status: 'closed' })
      },
    })
  })
}
