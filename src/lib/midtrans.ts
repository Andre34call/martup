// ==================== Midtrans Snap Integration ====================
// Loads the Midtrans Snap.js script and provides a promise-based API
// for opening the Snap payment popup.
//
// CONFIGURATION: Client key and environment (sandbox/production) are
// auto-detected from the server via /api/payment/config endpoint.
// This prevents the "access denied due to unauthorized transaction" error
// caused by client/server environment mismatch (e.g., sandbox client key
// with production server key).

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

// Cached client config — fetched once from server
interface ClientConfig {
  clientKey: string
  isProduction: boolean
  snapJsUrl: string
}

let cachedConfig: ClientConfig | null = null
let configPromise: Promise<ClientConfig | null> | null = null

let snapLoaded = false
let snapLoading: Promise<void> | null = null

/**
 * Fetch Midtrans client configuration from the server.
 * This ensures client and server always agree on sandbox vs production.
 * Cached after first fetch.
 */
async function getClientConfig(): Promise<ClientConfig | null> {
  if (cachedConfig) return cachedConfig
  if (configPromise) return configPromise

  configPromise = (async () => {
    try {
      const res = await fetch('/api/payment/config')
      const data = await res.json()
      if (data.success && data.data) {
        cachedConfig = {
          clientKey: data.data.clientKey,
          isProduction: data.data.isProduction,
          snapJsUrl: data.data.snapJsUrl,
        }
        return cachedConfig
      }
      return null
    } catch {
      // Fallback: use NEXT_PUBLIC env vars if server config is unavailable
      const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
      const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
      if (clientKey) {
        // Auto-detect from key prefix as last resort
        const keyIsSandbox = clientKey.startsWith('SB-Mid-')
        const detectedProduction = keyIsSandbox ? false : isProduction
        cachedConfig = {
          clientKey,
          isProduction: detectedProduction,
          snapJsUrl: detectedProduction
            ? 'https://app.midtrans.com/snap/snap.js'
            : 'https://app.sandbox.midtrans.com/snap/snap.js',
        }
        return cachedConfig
      }
      return null
    }
  })()

  return configPromise
}

/**
 * Load the Midtrans Snap.js script (only once).
 * Includes the client key as a data attribute.
 * Auto-detects sandbox vs production from the server config.
 */
export function loadSnapScript(): Promise<void> {
  if (snapLoaded && window.snap) return Promise.resolve()
  if (snapLoading) return snapLoading

  snapLoading = (async () => {
    const config = await getClientConfig()
    if (!config) {
      throw new Error('Midtrans not configured. Please set MIDTRANS_SERVER_KEY and NEXT_PUBLIC_MIDTRANS_CLIENT_KEY.')
    }

    const existingScript = document.querySelector('script[data-client-key]')
    if (existingScript && window.snap) {
      snapLoaded = true
      return
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = config.snapJsUrl
      script.setAttribute('data-client-key', config.clientKey)
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
  })()

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
