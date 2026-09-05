// ==================== DUITKU PAYMENT GATEWAY (POP API) ====================
// Server-side integration with Duitku Payment Gateway.
// Docs: https://docs.duitku.com/pop/id/
//
// Flow (Window Redirection / POP):
//   1. Server calls CreateInvoice → gets { reference, paymentUrl }
//   2. Frontend redirects user to paymentUrl (Duitku payment page — user picks VA / e-wallet / QRIS / card)
//   3. User completes payment → Duitku sends server-to-server POST callback to /api/payment/callback
//   4. User's browser is redirected to returnUrl (/api/payment/return) → back to orders screen
//
// Environment variables:
//   DUITKU_MERCHANT_CODE  — merchant code from Duitku portal (e.g. D12345)
//   DUITKU_API_KEY        — API key / merchant key from Duitku portal
//   DUITKU_IS_PRODUCTION  — 'true' for production, 'false' (or unset) for sandbox
//
// Signature formulas (HMAC SHA256, hex lowercase — MD5 & plain SHA256 are OBSOLETE):
//   CreateInvoice:     HMAC_SHA256(merchantCode + timestampMs, apiKey)   → header x-duitku-signature
//   Callback verify:   HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
//   TransactionStatus: HMAC_SHA256(merchantCode + merchantOrderId, apiKey)
//   GetPaymentMethod:  HMAC_SHA256(merchantCode + amount + datetime, apiKey)

import crypto from 'crypto'
import { logger } from '@/lib/logger'

// ==================== CONFIG (read at request time — no module-level stale values) ====================

export function getDuitkuMerchantCode(): string {
  return process.env.DUITKU_MERCHANT_CODE || ''
}

export function getDuitkuApiKey(): string {
  return process.env.DUITKU_API_KEY || ''
}

export function isDuitkuConfigured(): boolean {
  return !!getDuitkuMerchantCode() && !!getDuitkuApiKey()
}

export function isDuitkuProduction(): boolean {
  if (process.env.DUITKU_IS_PRODUCTION === 'true') return true
  if (process.env.DUITKU_IS_PRODUCTION === 'false') return false
  // Default to sandbox when unset — safer than accidentally hitting production
  return false
}

/** CreateInvoice endpoint (new POP API) */
export function getDuitkuApiBaseUrl(): string {
  return isDuitkuProduction()
    ? 'https://api-prod.duitku.com'
    : 'https://api-sandbox.duitku.com'
}

/** Payment page / Duitku JS base (app-prod / app-sandbox) */
export function getDuitkuAppBaseUrl(): string {
  return isDuitkuProduction()
    ? 'https://app-prod.duitku.com'
    : 'https://app-sandbox.duitku.com'
}

/** Legacy webapi base (transactionStatus + getpaymentmethod) */
export function getDuitkuWebApiBaseUrl(): string {
  return isDuitkuProduction()
    ? 'https://passport.duitku.com'
    : 'https://sandbox.duitku.com'
}

/** Public base URL of THIS app for callback/return URLs.
 *  Priority: NEXT_PUBLIC_SITE_URL (canonical prod domain) > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL (preview) > NEXTAUTH_URL > localhost.
 *  Using VERCEL_URL alone causes Duitku callback/return URLs to point to ephemeral preview deployments instead of martup-seven.vercel.app.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  // For preview deployments, fall back to the deployment URL (better than localhost for testing webhook reachability)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL !== 'http://localhost:3000') {
    return process.env.NEXTAUTH_URL
  }
  return process.env.NEXTAUTH_URL || 'http://localhost:3000'
}

export function getDuitkuCallbackUrl(): string {
  return `${getBaseUrl()}/api/payment/callback`
}

export function getDuitkuReturnUrl(): string {
  return `${getBaseUrl()}/api/payment/return`
}

// ==================== SIGNATURES ====================

/** HMAC SHA256 hex lowercase (Duitku's current standard) */
export function duitkuHmac(stringToSign: string, apiKey: string): string {
  return crypto.createHmac('sha256', apiKey).update(stringToSign).digest('hex')
}

export function createInvoiceSignature(merchantCode: string, timestampMs: string, apiKey: string): string {
  return duitkuHmac(`${merchantCode}${timestampMs}`, apiKey)
}

export function verifyCallbackSignature(
  merchantCode: string,
  amount: string,
  merchantOrderId: string,
  signature: string,
  apiKey: string
): boolean {
  const expected = duitkuHmac(`${merchantCode}${amount}${merchantOrderId}`, apiKey)
  if (!signature || expected.length !== signature.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export function transactionStatusSignature(merchantCode: string, merchantOrderId: string, apiKey: string): string {
  return duitkuHmac(`${merchantCode}${merchantOrderId}`, apiKey)
}

// ==================== CREATE INVOICE ====================

export interface DuitkuInvoiceItem {
  name: string
  price: number
  quantity: number
}

export interface DuitkuCustomerDetail {
  firstName?: string
  lastName?: string
  email?: string
  phoneNumber?: string
}

export interface CreateInvoiceParams {
  paymentAmount: number
  merchantOrderId: string
  productDetails: string
  email: string
  customerVaName?: string
  phoneNumber?: string
  itemDetails?: DuitkuInvoiceItem[]
  customerDetail?: DuitkuCustomerDetail
  paymentMethod?: string // '' (empty) = let customer choose on Duitku payment page
  expiryPeriod?: number // minutes (retail min 15; common: 5/10/60)
  callbackUrl?: string
  returnUrl?: string
}

export interface DuitkuInvoiceResult {
  success: boolean
  reference?: string
  paymentUrl?: string
  vaNumber?: string
  statusCode?: string
  statusMessage?: string
  httpStatus?: number
}

/**
 * Create a Duitku invoice (POP API).
 * Returns reference + paymentUrl. The SAME response is returned for ~5 minutes
 * when re-requesting with the same merchantOrderId (idempotent window).
 */
export async function createDuitkuInvoice(params: CreateInvoiceParams): Promise<DuitkuInvoiceResult> {
  const merchantCode = getDuitkuMerchantCode()
  const apiKey = getDuitkuApiKey()

  if (!merchantCode || !apiKey) {
    return { success: false, statusMessage: 'Payment gateway not configured' }
  }

  const timestamp = Date.now().toString()
  const signature = createInvoiceSignature(merchantCode, timestamp, apiKey)

  const body: Record<string, unknown> = {
    paymentAmount: Math.round(params.paymentAmount),
    merchantOrderId: params.merchantOrderId,
    productDetails: params.productDetails.slice(0, 255),
    additionalParam: '',
    merchantUserInfo: params.email,
    paymentMethod: params.paymentMethod || '',
    customerVaName: (params.customerVaName || 'Customer').slice(0, 20),
    email: params.email,
    phoneNumber: params.phoneNumber || '',
    callbackUrl: params.callbackUrl || getDuitkuCallbackUrl(),
    returnUrl: params.returnUrl || getDuitkuReturnUrl(),
    expiryPeriod: params.expiryPeriod || 60,
  }

  if (params.itemDetails && params.itemDetails.length > 0) {
    body.itemDetails = params.itemDetails.map((item) => ({
      name: item.name.slice(0, 50),
      price: Math.round(item.price),
      quantity: item.quantity,
    }))
  }

  if (params.customerDetail) {
    body.customerDetail = {
      firstName: (params.customerDetail.firstName || '').slice(0, 50),
      lastName: (params.customerDetail.lastName || '').slice(0, 50),
      email: params.customerDetail.email || params.email,
      phoneNumber: params.customerDetail.phoneNumber || '',
    }
  }

  try {
    const response = await fetch(`${getDuitkuApiBaseUrl()}/api/merchant/createInvoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-duitku-signature': signature,
        'x-duitku-timestamp': timestamp,
        'x-duitku-merchantcode': merchantCode,
      },
      body: JSON.stringify(body),
      // Duitku can be slow on cold starts — 25s to stay under Vercel's limits
      signal: AbortSignal.timeout(25_000),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || data.statusCode !== '00') {
      logger.error(
        { httpStatus: response.status, data, merchantOrderId: params.merchantOrderId },
        'Duitku createInvoice failed'
      )
      return {
        success: false,
        statusCode: data.statusCode,
        statusMessage: data.statusMessage || `HTTP ${response.status}`,
        httpStatus: response.status,
      }
    }

    return {
      success: true,
      reference: data.reference,
      paymentUrl: data.paymentUrl,
      vaNumber: data.vaNumber,
      statusCode: data.statusCode,
      statusMessage: data.statusMessage,
    }
  } catch (error: unknown) {
    logger.error({ err: error, merchantOrderId: params.merchantOrderId }, 'Duitku createInvoice exception')
    return { success: false, statusMessage: 'Gagal menghubungi payment gateway' }
  }
}

// ==================== TRANSACTION STATUS ====================

export interface DuitkuStatusResult {
  success: boolean
  statusCode?: string // '00' success, '01' pending, '02' failed/cancelled/expired
  statusMessage?: string
  reference?: string
  amount?: number
  paymentCode?: string
  httpStatus?: number
}

/**
 * Check transaction status via the legacy webapi endpoint.
 * Same merchant credentials work for both POP invoices and this endpoint.
 * NOTE: Do NOT poll repeatedly — Duitku blocks hit-rate abuse for ~1 hour.
 */
export async function checkDuitkuTransactionStatus(merchantOrderId: string): Promise<DuitkuStatusResult> {
  const merchantCode = getDuitkuMerchantCode()
  const apiKey = getDuitkuApiKey()

  if (!merchantCode || !apiKey) {
    return { success: false, statusMessage: 'Payment gateway not configured' }
  }

  const signature = transactionStatusSignature(merchantCode, merchantOrderId, apiKey)

  try {
    const response = await fetch(`${getDuitkuWebApiBaseUrl()}/webapi/api/merchant/transactionStatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ merchantCode, merchantOrderId, signature }),
      signal: AbortSignal.timeout(20_000),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      logger.error(
        { httpStatus: response.status, data, merchantOrderId },
        'Duitku transactionStatus failed'
      )
      return { success: false, statusMessage: data?.Message || `HTTP ${response.status}`, httpStatus: response.status }
    }

    return {
      success: true,
      statusCode: data.statusCode,
      statusMessage: data.statusMessage,
      reference: data.reference,
      amount: data.amount ? Number(data.amount) : undefined,
      paymentCode: data.paymentCode,
    }
  } catch (error: unknown) {
    logger.error({ err: error, merchantOrderId }, 'Duitku transactionStatus exception')
    return { success: false, statusMessage: 'Gagal menghubungi payment gateway' }
  }
}

// ==================== PAYMENT METHODS ====================

export interface DuitkuPaymentMethod {
  code: string
  name: string
  image?: string
  fee: number
}

/**
 * Get active payment methods + fees for a given amount.
 * Uses the legacy webapi endpoint (works with the same merchant credentials).
 */
export async function getDuitkuPaymentMethods(amount: number): Promise<DuitkuPaymentMethod[]> {
  const merchantCode = getDuitkuMerchantCode()
  const apiKey = getDuitkuApiKey()

  if (!merchantCode || !apiKey) return []

  // Jakarta time 'yyyy-MM-dd HH:mm:ss' (UTC+7)
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const datetime = now.toISOString().replace('T', ' ').slice(0, 19)

  const signature = duitkuHmac(`${merchantCode}${Math.round(amount)}${datetime}`, apiKey)

  try {
    const response = await fetch(
      `${getDuitkuWebApiBaseUrl()}/webapi/api/merchant/paymentmethod/getpaymentmethod`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ merchantcode: merchantCode, amount: Math.round(amount), datetime, signature }),
        signal: AbortSignal.timeout(15_000),
      }
    )

    const data = await response.json().catch(() => ({}))

    if (!response.ok || data.responseCode !== '00' || !Array.isArray(data.paymentFee)) {
      logger.warn({ httpStatus: response.status, data }, 'Duitku getpaymentmethod failed')
      return []
    }

    return data.paymentFee.map((m: Record<string, unknown>) => ({
      code: String(m.paymentMethod || ''),
      name: String(m.paymentName || m.paymentMethod || ''),
      image: m.paymentImage ? String(m.paymentImage) : undefined,
      fee: Number(m.totalFee || 0),
    }))
  } catch (error: unknown) {
    logger.warn({ err: error }, 'Duitku getpaymentmethod exception')
    return []
  }
}

// ==================== STATIC PAYMENT METHOD LABELS ====================
// Codes from https://docs.duitku.com/pop/id/ — Payment Method table

export const DUITKU_METHOD_LABELS: Record<string, string> = {
  VC: 'Kartu Kredit/Debit',
  BC: 'BCA Virtual Account',
  M2: 'Mandiri Virtual Account',
  VA: 'Maybank Virtual Account',
  I1: 'BNI Virtual Account',
  B1: 'CIMB Niaga Virtual Account',
  BT: 'Permata Bank Virtual Account',
  A1: 'ATM Bersama',
  AG: 'Bank Artha Graha',
  NC: 'Bank Neo Commerce (BNC)',
  BR: 'BRIVA (BRI Virtual Account)',
  S1: 'Bank Sahabat Sampoerna',
  DM: 'Danamon Virtual Account',
  BV: 'BSI Virtual Account',
  FT: 'Pegadaian/ALFA/Pos',
  IR: 'Indomaret',
  OV: 'OVO',
  SA: 'ShopeePay Apps',
  LF: 'LinkAja (Fixed Fee)',
  LA: 'LinkAja (Percentage Fee)',
  DA: 'DANA',
  SL: 'ShopeePay Account Link',
  OL: 'OVO Account Link',
  SP: 'ShopeePay QRIS',
  NQ: 'Nobu QRIS',
  GQ: 'Gudang Voucher',
  SQ: 'Nusapay QRIS',
  DN: 'Indodana Paylater',
  AT: 'ATOME',
  JP: 'Jenius Pay',
  T1: 'Tokopedia Card Payment',
  T2: 'Tokopedia E-Wallet',
  T3: 'Tokopedia Others',
}

export function getDuitkuMethodLabel(code?: string | null): string {
  if (!code) return 'Duitku'
  return DUITKU_METHOD_LABELS[code] || code
}
