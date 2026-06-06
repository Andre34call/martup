// ==================== Midtrans Shared Configuration ====================
// Single source of truth for Midtrans environment detection.
// Auto-detects sandbox vs production from key prefixes to prevent
// the "access denied due to unauthorized transaction" error caused by
// client/server environment mismatch.
//
// Midtrans key format:
//   Sandbox:    SB-Mid-server-XXXXX / SB-Mid-client-XXXXX
//   Production: Mid-server-XXXXX    / Mid-client-XXXXX

import { logger } from '@/lib/logger'

/**
 * Detect if a Midtrans key belongs to the sandbox environment.
 * Sandbox keys always start with "SB-Mid-".
 */
export function isSandboxKey(key: string): boolean {
  return key.startsWith('SB-Mid-')
}

/**
 * Detect if a Midtrans key belongs to the production environment.
 * Production keys start with "Mid-" (no "SB-" prefix).
 */
export function isProductionKey(key: string): boolean {
  return key.startsWith('Mid-') && !key.startsWith('SB-Mid-')
}

// ==================== SERVER-SIDE CONFIG ====================

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ''
const ENV_FLAG_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true'

/**
 * Auto-detect production mode from server key prefix.
 * Falls back to MIDTRANS_IS_PRODUCTION env var if key is empty or doesn't match expected prefix.
 */
function detectServerIsProduction(): boolean {
  if (!SERVER_KEY) return ENV_FLAG_IS_PRODUCTION

  const keyIsProduction = isProductionKey(SERVER_KEY)
  const keyIsSandbox = isSandboxKey(SERVER_KEY)

  if (keyIsSandbox && ENV_FLAG_IS_PRODUCTION) {
    logger.error(
      'Midtrans CONFIG MISMATCH: MIDTRANS_IS_PRODUCTION=true but server key has sandbox prefix (SB-Mid-). ' +
      'Forcing to sandbox mode. Please update MIDTRANS_IS_PRODUCTION or use a production server key.'
    )
    return false
  }

  if (keyIsProduction && !ENV_FLAG_IS_PRODUCTION) {
    logger.error(
      'Midtrans CONFIG MISMATCH: MIDTRANS_IS_PRODUCTION=false but server key has production prefix (Mid-). ' +
      'Forcing to production mode. Please update MIDTRANS_IS_PRODUCTION or use a sandbox server key.'
    )
    return true
  }

  // If key doesn't match known prefixes, trust the env var
  if (!keyIsSandbox && !keyIsProduction) {
    return ENV_FLAG_IS_PRODUCTION
  }

  // Key prefix and env var agree
  return keyIsProduction
}

/** Whether the server-side Midtrans API should use production endpoints */
export const MIDTRANS_SERVER_IS_PRODUCTION = detectServerIsProduction()

/** Server key for Midtrans API authentication */
export const MIDTRANS_SERVER_KEY = SERVER_KEY

/** Snap API URL based on auto-detected environment */
export const SNAP_API_URL = MIDTRANS_SERVER_IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1/transactions'
  : 'https://app.sandbox.midtrans.com/snap/v1/transactions'

/** Midtrans API base URL based on auto-detected environment */
export const MIDTRANS_API_URL = MIDTRANS_SERVER_IS_PRODUCTION
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com'

/** Authorization header for Midtrans API calls */
export const MIDTRANS_AUTH_HEADER = `Basic ${Buffer.from(SERVER_KEY + ':').toString('base64')}`

// Log the detected environment at startup
if (SERVER_KEY) {
  logger.info(
    { isProduction: MIDTRANS_SERVER_IS_PRODUCTION, keyPrefix: SERVER_KEY.substring(0, 12) + '...' },
    'Midtrans server configuration loaded'
  )
}

// ==================== CLIENT-SIDE CONFIG HELPER ====================
// This function is used by the /api/payment/config endpoint
// to provide consistent client configuration without requiring
// NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION.

export interface MidtransClientConfig {
  clientKey: string
  isProduction: boolean
  snapJsUrl: string
}

/**
 * Get client-side Midtrans configuration derived from server-side keys.
 * Used by /api/payment/config endpoint to ensure client/server always agree.
 */
export function getMidtransClientConfig(): MidtransClientConfig | null {
  const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ''
  if (!clientKey) return null

  // Auto-detect from client key prefix (same logic as server-side)
  const keyIsProduction = isProductionKey(clientKey)
  const keyIsSandbox = isSandboxKey(clientKey)

  let isProduction: boolean
  if (keyIsSandbox) {
    isProduction = false
  } else if (keyIsProduction) {
    isProduction = true
  } else {
    // Unknown prefix — fall back to server's detected environment
    isProduction = MIDTRANS_SERVER_IS_PRODUCTION
  }

  // Cross-validate: client and server should be in the same environment
  if (isProduction !== MIDTRANS_SERVER_IS_PRODUCTION) {
    logger.error(
      `Midtrans CLIENT/SERVER MISMATCH: Client key indicates ${isProduction ? 'production' : 'sandbox'}, ` +
      `but server key indicates ${MIDTRANS_SERVER_IS_PRODUCTION ? 'production' : 'sandbox'}. ` +
      `This will cause "access denied" errors. Please ensure both keys are from the same Midtrans environment.`
    )
  }

  return {
    clientKey,
    isProduction,
    snapJsUrl: isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js',
  }
}
