import { logger } from '@/lib/logger'
import { MIDTRANS_SERVER_KEY, MIDTRANS_SERVER_IS_PRODUCTION, MIDTRANS_API_URL, MIDTRANS_AUTH_HEADER } from '@/lib/midtrans-config'

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
    const url = `${MIDTRANS_API_URL}/v2/${orderId}/refund`
    const body: Record<string, unknown> = {}
    if (amount) body.amount = amount
    if (reason) body.reason = reason

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MIDTRANS_AUTH_HEADER,
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
