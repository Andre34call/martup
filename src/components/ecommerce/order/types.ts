// ==================== SHARED TYPES FOR ORDER COMPONENTS ====================

// Typed wrapper for payment reference data (shared parsePaymentReference returns Record<string, unknown>)
export interface PaymentRefData {
  va_numbers?: Array<{ bank: string; va_number: string }>
  va_number?: string
  bank?: string
  permata_va_number?: string
  payment_code?: string
  bill_key?: string
  biller_code?: string
  qr_url?: string
  actions?: Array<{ name: string; url: string; method?: string }>
  payment_type?: string
}

// Service proof data type
export interface ServiceProofData {
  orderId: string
  orderNumber: string
  isServiceOrder: boolean
  status: string
  proofImages: string[]
  sellerCompletedAt: string | null
  autoConfirmAt: string | null
  buyerConfirmedAt: string | null
}
