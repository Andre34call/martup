import { logger } from '@/lib/logger'

// IMPORTANT: Read env vars at request time (not module level) to avoid stale values
// in Vercel serverless cold starts. Also auto-detect sandbox from key prefix.

function getMidtransServerKey(): string {
  return process.env.MIDTRANS_SERVER_KEY || ''
}

function isMidtransProduction(): boolean {
  if (process.env.MIDTRANS_IS_PRODUCTION === 'true' || process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true') {
    return true
  }
  const key = getMidtransServerKey()
  if (key.startsWith('SB-')) {
    return false // Sandbox key detected
  }
  return !!key
}

function getBaseUrl(): string {
  return isMidtransProduction()
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com'
}

/**
 * Request a refund from Midtrans for a given order.
 * Uses the Midtrans refund API: POST /v2/{order_id}/refund
 */
export async function requestMidtransRefund(
  orderId: string,
  amount?: number,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  const MIDTRANS_SERVER_KEY = getMidtransServerKey()
  if (!MIDTRANS_SERVER_KEY) {
    logger.warn('MIDTRANS_SERVER_KEY not configured — skipping Midtrans refund request')
    return { success: false, message: 'Midtrans not configured' }
  }

  const BASE_URL = getBaseUrl()

  try {
    const url = `${BASE_URL}/v2/${orderId}/refund`
    const body: Record<string, unknown> = {}
    if (amount) body.amount = amount
    if (reason) body.reason = reason

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64')}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (response.ok && (data.status_code === '200' || data.status_code === '201')) {
      logger.info({ orderId, amount }, 'Midtrans refund requested successfully')
      return { success: true, message: data.status_message }
    } else {
      logger.warn({ orderId, amount, statusCode: data.status_code, message: data.status_message }, 'Midtrans refund request failed')
      return { success: false, message: data.status_message || 'Midtrans refund failed' }
    }
  } catch (error) {
    logger.error({ err: error, orderId }, 'Midtrans refund request exception')
    return { success: false, message: 'Midtrans refund request failed' }
  }
}
