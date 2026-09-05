// ==================== PAYMENT UTILITIES ====================
// Shared payment logic extracted from checkout-screen, order-screen, and order store.
// Single source of truth to prevent accidental feature deletion when modifying payment flow.

import type { Order } from '@/lib/types'

/**
 * Check if an order is a Cash on Delivery (COD) order.
 * Used in: order-screen.tsx, order.ts store, checkout-screen.tsx
 */
export function isCodOrder(order: Order): boolean {
  const pm = order.paymentMethod?.toLowerCase() || ''
  const ps = order.paymentStatus?.toLowerCase() || ''
  return pm === 'cod' || pm.includes('bayar di tempat') || ps === 'cod'
}

/**
 * Check if an order uses an online payment gateway (Duitku) for payment.
 * Used in: order-screen.tsx for payment retry logic
 */
export function isDuitkuPayment(order: Order): boolean {
  const pm = order.paymentMethod?.toLowerCase() || ''
  if (pm === 'duitku') return true
  // Duitku webhook stores the resolved method label (e.g. "BCA Virtual Account")
  return [
    'virtual account', 'briva', 'qris', 'ovo', 'dana', 'shopeepay', 'linkaja',
    'indomaret', 'alfamart', 'jenius', 'kartu kredit', 'kartu debit',
    'bca', 'mandiri', 'bni', 'bri', 'permata', 'bsi', 'danamon', 'cimb',
    'transfer & e-wallet', 'duitku',
  ].some((keyword) => pm.includes(keyword))
}

/**
 * Legacy alias — kept for backward compatibility with older code paths.
 */
export const isMidtransPayment = isDuitkuPayment

/**
 * Extracts payment reference data (VA number, payment code, etc.) from Midtrans Snap result.
 * Used in: checkout-screen.tsx, order-screen.tsx
 */
export function extractPaymentReference(result: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!result) return null
  const ref: Record<string, unknown> = {}

  // VA numbers
  const vaNumbers = result.va_numbers as Array<{ bank: string; va_number: string }> | undefined
  if (vaNumbers && vaNumbers.length > 0) {
    ref.va_numbers = vaNumbers
    ref.va_number = vaNumbers[0].va_number
    ref.bank = vaNumbers[0].bank
  }

  // Permata VA number (single field)
  if (result.permata_va_number) {
    ref.permata_va_number = result.permata_va_number
    if (!ref.va_number) {
      ref.va_number = result.permata_va_number as string
      ref.bank = 'permata'
    }
  }

  // Payment code (for cstore / indomaret / alfamart)
  if (result.payment_code) {
    ref.payment_code = result.payment_code
  }

  // Bill key / biller code (for mandiri bill payment)
  if (result.bill_key) ref.bill_key = result.bill_key
  if (result.biller_code) ref.biller_code = result.biller_code

  // QR URL (for QRIS / gopay)
  if (result.qr_url) ref.qr_url = result.qr_url

  // Actions (may contain payment URL for e-wallets)
  if (result.actions && Array.isArray(result.actions)) {
    ref.actions = result.actions
  }

  // Payment type for display
  if (result.payment_type) ref.payment_type = result.payment_type

  // Only return if we have at least one reference field
  if (ref.va_number || ref.payment_code || ref.bill_key || ref.qr_url || ref.actions) {
    return ref
  }
  return null
}

/**
 * Parse a payment reference JSON string into structured data.
 * Used in: order-screen.tsx for displaying payment details
 */
export function parsePaymentReference(refString: string | undefined): Record<string, unknown> | null {
  if (!refString) return null
  try {
    const parsed = JSON.parse(refString)
    if (typeof parsed === 'object' && parsed !== null) {
      // Only return if there's at least one useful reference field
      if (parsed.va_number || parsed.payment_code || parsed.bill_key || parsed.qr_url || parsed.actions) {
        return parsed as Record<string, unknown>
      }
    }
  } catch { /* invalid JSON */ }
  return null
}

/**
 * Get a human-readable label for a payment method.
 * Used in: order-screen.tsx, checkout-screen.tsx
 */
export function getPaymentMethodLabel(paymentMethod?: string): string {
  if (!paymentMethod) return 'COD'
  const pm = paymentMethod.toLowerCase()
  if (pm === 'wallet' || pm === 'martup pay') return 'MartUp Pay'
  if (pm === 'duitku') return 'Transfer & E-Wallet'
  if (pm === 'midtrans') return 'Transfer & E-Wallet' // legacy orders
  if (pm === 'card') return 'Kartu Kredit/Debit'
  if (pm === 'cod' || pm.includes('bayar di tempat')) return 'Bayar di Tempat (COD)'
  // Duitku payment codes / resolved method labels (set by webhook)
  if (pm.includes('bca')) return 'BCA Virtual Account'
  if (pm.includes('mandiri')) return 'Mandiri Virtual Account'
  if (pm.includes('bni')) return 'BNI Virtual Account'
  if (pm.includes('bri') || pm.includes('briva')) return 'BRI Virtual Account'
  if (pm.includes('permata')) return 'Permata Virtual Account'
  if (pm.includes('bsi')) return 'BSI Virtual Account'
  if (pm.includes('danamon')) return 'Danamon Virtual Account'
  if (pm.includes('cimb')) return 'CIMB Niaga Virtual Account'
  if (pm.includes('maybank')) return 'Maybank Virtual Account'
  if (pm.includes('neo commerce') || pm === 'bnc') return 'Bank Neo Commerce'
  if (pm.includes('indomaret')) return 'Indomaret'
  if (pm.includes('alfamart') || pm.includes('pegadaian') || pm.includes('pos')) return 'Retail (ALFA/Pos/Pegadaian)'
  if (pm.includes('gopay')) return 'GoPay'
  if (pm.includes('ovo')) return 'OVO'
  if (pm.includes('dana')) return 'DANA'
  if (pm.includes('shopeepay')) return 'ShopeePay'
  if (pm.includes('linkaja')) return 'LinkAja'
  if (pm.includes('qris')) return 'QRIS'
  if (pm.includes('jenius')) return 'Jenius Pay'
  if (pm.includes('atome')) return 'ATOME'
  if (pm.includes('indodana')) return 'Indodana Paylater'
  if (pm.includes('kartu kredit') || pm.includes('credit card') || pm.includes('visa') || pm.includes('master')) return 'Kartu Kredit/Debit'
  if (pm.includes('virtual account') || pm.includes('va')) return 'Virtual Account'
  if (pm.includes('transfer') || pm.includes('e-wallet') || pm.includes('ewallet')) return 'Transfer & E-Wallet'
  // Fallback: capitalize first letter
  return paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)
}

/**
 * Get a display label for a payment type (e.g., from Duitku paymentCode).
 * Used in: order-screen.tsx for payment detail display
 */
export function getPaymentTypeLabel(paymentType?: string): string {
  if (!paymentType) return 'Transfer / E-Wallet'
  const labels: Record<string, string> = {
    // Duitku payment method codes
    'VC': 'Kartu Kredit/Debit',
    'BC': 'BCA Virtual Account',
    'M2': 'Mandiri Virtual Account',
    'VA': 'Maybank Virtual Account',
    'I1': 'BNI Virtual Account',
    'B1': 'CIMB Niaga Virtual Account',
    'BT': 'Permata Virtual Account',
    'BR': 'BRI Virtual Account (BRIVA)',
    'NC': 'Bank Neo Commerce',
    'DM': 'Danamon Virtual Account',
    'BV': 'BSI Virtual Account',
    'FT': 'Pegadaian/ALFA/Pos',
    'IR': 'Indomaret',
    'OV': 'OVO',
    'SA': 'ShopeePay Apps',
    'SL': 'ShopeePay Account Link',
    'LA': 'LinkAja',
    'LF': 'LinkAja',
    'DA': 'DANA',
    'OL': 'OVO Account Link',
    'SP': 'ShopeePay QRIS',
    'NQ': 'Nobu QRIS',
    'SQ': 'Nusapay QRIS',
    'GQ': 'Gudang Voucher',
    'DN': 'Indodana Paylater',
    'AT': 'ATOME',
    'JP': 'Jenius Pay',
    // Legacy Midtrans types (for historical orders)
    'bank_transfer': 'Transfer Bank',
    'gopay': 'GoPay',
    'shopeepay': 'ShopeePay',
    'qris': 'QRIS',
    'credit_card': 'Kartu Kredit',
    'cstore': 'Gerai (Indomaret/Alfamart)',
    'echannel': 'Mandiri Bill',
    'bca_klikpay': 'BCA KlikPay',
    'bri_epay': 'BRI Epay',
    'card': 'Kartu Kredit/Debit',
    'duitku': 'Transfer & E-Wallet',
  }
  return labels[paymentType] || paymentType
}
