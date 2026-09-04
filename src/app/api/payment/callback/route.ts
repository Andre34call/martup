import { NextRequest, NextResponse } from 'next/server'
import {
  getDuitkuMerchantCode,
  getDuitkuApiKey,
  isDuitkuConfigured,
  verifyCallbackSignature,
  getDuitkuMethodLabel,
} from '@/lib/duitku'
import {
  processOrderPaymentResult,
  processDepositPaymentResult,
} from '@/lib/duitku-webhook'
import { db } from '@/lib/db'

import { logger } from '@/lib/logger'

// ==================== POST /api/payment/callback ====================
// Duitku webhook — called by Duitku servers when payment status changes.
// Content-Type: application/x-www-form-urlencoded
// Docs: https://docs.duitku.com/pop/id/ → Callback
//
// NO standard auth required (server-to-server) — the request is authenticated by
// verifying signature = HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey).
// This path is CSRF-exempt (src/lib/csrf.ts) and does NOT require a session.
//
// IDEMPOTENCY: handled inside processOrderPaymentResult / processDepositPaymentResult.
// MUST respond HTTP 200 (any body) so Duitku stops retrying (max 5 retries).

function textResponse(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  })
}

export async function POST(request: NextRequest) {
  try {
    const merchantCode = getDuitkuMerchantCode()
    const apiKey = getDuitkuApiKey()

    if (!isDuitkuConfigured()) {
      logger.error('Duitku callback received but DUITKU_MERCHANT_CODE / DUITKU_API_KEY not configured')
      return textResponse('FAILED: Duitku not configured', 500)
    }

    // ==================== Parse payload (form-urlencoded primary, JSON fallback) ====================
    let fields: Record<string, string> = {}
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const json = await request.json().catch(() => ({}))
      fields = Object.fromEntries(
        Object.entries(json as Record<string, unknown>).map(([k, v]) => [k, v == null ? '' : String(v)])
      )
    } else {
      const formData = await request.formData().catch(() => null)
      if (formData) {
        for (const [key, value] of formData.entries()) {
          fields[key] = typeof value === 'string' ? value : ''
        }
      }
    }

    const {
      merchantCode: cbMerchantCode,
      amount,
      merchantOrderId,
      productDetail,
      productDetails,
      additionalParam,
      paymentCode,
      resultCode,
      merchantUserId,
      reference,
      signature,
      settlementDate,
      publisherOrderId,
    } = fields

    logger.info(
      {
        merchantOrderId,
        resultCode,
        paymentCode,
        reference,
        amount,
        publisherOrderId,
      },
      'Duitku callback received'
    )

    // ==================== Required fields ====================
    if (!cbMerchantCode || !amount || !merchantOrderId || !signature) {
      logger.error({ fields: Object.keys(fields) }, 'Duitku callback: Missing required parameters')
      return textResponse('FAILED: Bad Parameter', 400)
    }

    // Merchant code must match ours
    if (cbMerchantCode !== merchantCode) {
      logger.error({ received: cbMerchantCode }, 'Duitku callback: merchantCode mismatch')
      return textResponse('FAILED: Bad Parameter', 400)
    }

    // ==================== Verify signature ====================
    // signature = HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
    const validSignature = verifyCallbackSignature(cbMerchantCode, amount, merchantOrderId, signature, apiKey)
    if (!validSignature) {
      logger.error({ merchantOrderId }, 'Duitku callback: Invalid signature')
      return textResponse('FAILED: Bad Signature', 403)
    }

    // ==================== Route by merchantOrderId prefix ====================
    // DEPOSIT-{id}      → wallet top-up deposits
    // {orderNumber}[-Rn] → order payments (retry suffix stripped)
    const isDeposit = merchantOrderId.startsWith('DEPOSIT-')
    const orderNumber = merchantOrderId.replace(/-R\d+$/, '')

    if (isDeposit) {
      const depositId = merchantOrderId.replace('DEPOSIT-', '')

      // Verify amount matches the deposit
      const deposit = await db.deposit.findUnique({
        where: { id: depositId },
        select: { amount: true },
      })
      if (!deposit) {
        logger.error({ depositId }, 'Duitku callback: Deposit not found')
        return textResponse('SUCCESS') // 200 so Duitku doesn't retry a record that doesn't exist
      }
      if (String(deposit.amount) !== String(Number(amount))) {
        logger.error(
          { depositId, expected: String(deposit.amount), received: amount },
          'Duitku callback: Deposit amount mismatch'
        )
        return textResponse('FAILED: Amount mismatch', 400)
      }

      const result = await processDepositPaymentResult(depositId, {
        resultCode: resultCode || '',
        paymentCode,
        reference,
        settlementDate,
        merchantOrderId,
      })

      logger.info({ depositId, outcome: result.outcome }, 'Duitku deposit callback processed')
      return textResponse('SUCCESS')
    }

    // ==================== ORDER payment ====================
    const order = await db.order.findUnique({
      where: { orderNumber },
      select: { totalAmount: true },
    })
    if (!order) {
      logger.error({ orderNumber }, 'Duitku callback: Order not found')
      return textResponse('SUCCESS') // 200 — unknown order, stop retrying
    }
    if (Number(order.totalAmount) !== Number(amount)) {
      logger.error(
        { orderNumber, expected: String(order.totalAmount), received: amount },
        'Duitku callback: Order amount mismatch'
      )
      return textResponse('FAILED: Amount mismatch', 400)
    }

    const result = await processOrderPaymentResult(orderNumber, {
      resultCode: resultCode || '',
      paymentCode: paymentCode ? getDuitkuMethodLabel(paymentCode) : undefined,
      reference,
      settlementDate,
      merchantOrderId,
    })

    logger.info(
      { orderNumber, outcome: result.outcome, productDetail: productDetail || productDetails, merchantUserId, additionalParam: additionalParam || undefined },
      'Duitku order callback processed'
    )

    // Always 200 for valid callbacks so Duitku stops retrying
    return textResponse('SUCCESS')
  } catch (error: unknown) {
    logger.error({ err: error }, 'Duitku callback POST error')
    // 500 → Duitku will retry (up to 5 times)
    return textResponse('FAILED: Server error', 500)
  }
}
