"use client"

import {
  MapPin, Truck, CreditCard, Wallet,
  Smartphone, Landmark, Banknote,
} from "lucide-react"
import type { ShippingOption } from "@/lib/types"

// ==================== API RESPONSE TYPES ====================
export type ShippingResponse = { success: boolean; data?: { rates?: ShippingOption[] }; error?: string }
export type VoucherValidateResponse = { success: boolean; data?: { valid: boolean; message?: string; discountAmount: number }; error?: string }
export type OrderCreateResponse = { success: boolean; data?: { id: string; orderNumber: string }; error?: string }
export type WalletDebitResponse = { success: boolean; error?: string }
export type PaymentCreateResponse = { success: boolean; data?: { token: string }; error?: string }

// ==================== CHECKOUT STEP CONSTANTS ====================
export const CHECKOUT_STEPS = [
  { key: 'address', label: 'Alamat', icon: MapPin },
  { key: 'shipping', label: 'Pengiriman', icon: Truck },
  { key: 'payment', label: 'Pembayaran', icon: CreditCard },
] as const

// ==================== PAYMENT METHODS ====================
export const PAYMENT_METHODS = [
  { id: "wallet", name: "MartUp Pay", icon: Wallet, description: "Bayar cepat dari saldo", color: "emerald" },
  { id: "midtrans", name: "Transfer & E-Wallet", icon: Smartphone, description: "VA, GoPay, OVO, Dana, ShopeePay", color: "blue" },
  { id: "card", name: "Kartu Kredit/Debit", icon: CreditCard, description: "Visa, Mastercard, JCB", color: "purple" },
  { id: "escrow", name: "Transfer Bank", icon: Landmark, description: "Transfer ke rekening MartUp — dana aman sampai barang diterima", color: "amber" },
  { id: "cod", name: "Bayar di Tempat (COD)", icon: Banknote, description: "Bayar saat barang diterima", color: "orange" },
] as const

// ==================== BANK ACCOUNT TYPE ====================
export type EscrowBankAccount = { bankName: string; accountNumber: string; accountHolder: string }
