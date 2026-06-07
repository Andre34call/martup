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
 * Check if an order uses Midtrans for payment (transfer, e-wallet, card).
 * Used in: order-screen.tsx for payment retry logic
 */
export function isMidtransPayment(order: Order): boolean {
  const pm = order.paymentMethod?.toLowerCase() || ''
  return pm === 'midtrans' || pm === 'card' ||
    pm.includes('transfer') || pm.includes('ewallet') || pm.includes('e-wallet') ||
    pm.includes('gopay') || pm.includes('ovo') || pm.includes('dana') ||
    pm.includes('shopeepay') || pm.includes('qris') || pm.includes('credit card') ||
    pm.includes('debit') || pm.includes('bank') || pm.includes('cstore')
}

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
  if (pm === 'midtrans') return 'Transfer & E-Wallet'
  if (pm === 'card') return 'Kartu Kredit/Debit'
  if (pm === 'cod' || pm.includes('bayar di tempat')) return 'Bayar di Tempat (COD)'
  // Midtrans webhook may overwrite with specific types
  if (pm.includes('gopay')) return 'GoPay'
  if (pm.includes('ovo')) return 'OVO'
  if (pm.includes('dana')) return 'DANA'
  if (pm.includes('shopeepay')) return 'ShopeePay'
  if (pm.includes('qris')) return 'QRIS'
  if (pm.includes('bank_transfer') || pm.includes('va')) return 'Transfer Bank (VA)'
  if (pm.includes('credit_card') || pm.includes('card')) return 'Kartu Kredit/Debit'
  if (pm.includes('cstore') || pm.includes('indomaret') || pm.includes('alfamart')) return 'Convenience Store'
  if (pm.includes('echannel') || pm.includes('mandiri')) return 'Mandiri Bill Payment'
  if (pm.includes('transfer') || pm.includes('e-wallet') || pm.includes('ewallet')) return 'Transfer & E-Wallet'
  // Fallback: capitalize first letter
  return paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)
}

/**
 * Get a display label for payment type (e.g., from Midtrans payment_type field).
 * Used in: order-screen.tsx for payment detail display
 */
export function getPaymentTypeLabel(paymentType?: string): string {
  if (!paymentType) return 'Transfer / E-Wallet'
  const labels: Record<string, string> = {
    'bank_transfer': 'Transfer Bank',
    'gopay': 'GoPay',
    'ovo': 'OVO',
    'dana': 'DANA',
    'shopeepay': 'ShopeePay',
    'qris': 'QRIS',
    'credit_card': 'Kartu Kredit',
    'cstore': 'Gerai (Indomaret/Alfamart)',
    'echannel': 'Mandiri Bill',
    'danamon_online': 'Danamon Online',
    'bca_klikpay': 'BCA KlikPay',
    'bca_klikbca': 'KlikBCA',
    'mandiri_clickpay': 'Mandiri ClickPay',
    'bri_epay': 'BRI Epay',
    'cimb_clicks': 'CIMB Clicks',
    'card': 'Kartu Kredit/Debit',
  }
  return labels[paymentType] || paymentType
}
