import { logger } from '@/lib/logger'

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ''
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true'

const BASE_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com'

/**
 * Request a refund from Midtrans for a given order.
 * Uses the Midtrans refund API: POST /v2/{order_id}/refund
 */
export async function requestMidtransRefund(
  orderId: string,
  amount?: number,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  if (!MIDTRANS_SERVER_KEY) {
    logger.warn('MIDTRANS_SERVER_KEY not configured — skipping Midtrans refund request')
    return { success: false, message: 'Midtrans not configured' }
  }

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
