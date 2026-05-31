import type { ShippingOption } from './types'

// ==================== PLATFORM CONFIGURATION ====================
// Centralized constants — single source of truth for all magic numbers

// Platform fees
export const DEFAULT_PLATFORM_FEE = 1000          // Rp 1,000
export const DEFAULT_ADMIN_FEE = 1000             // Rp 1,000 (withdrawal admin fee)
export const MIN_WITHDRAW_AMOUNT = 10000          // Rp 10,000 minimum withdrawal
export const DEFAULT_COMMISSION_RATE = 0.05       // 5% commission

// Product defaults
export const DEFAULT_PRODUCT_WEIGHT = 500         // grams — fallback when product weight not set
export const DEFAULT_SHIPPING_ORIGIN_CITY = 'Jakarta' // fallback origin city for shipping calc

// OTP & Auth timing
export const OTP_RESEND_COOLDOWN_SECONDS = 60     // seconds before OTP resend
export const OTP_MAX_ATTEMPTS = 5                 // max OTP verification attempts

// UI timing
export const BANNER_CAROUSEL_INTERVAL_MS = 3500   // banner auto-rotate interval
export const SPLASH_DURATION_MS = 2000            // splash screen duration

// ==================== SHIPPING OPTIONS ====================
// Default hardcoded shipping options for fallback when API is unavailable
export const SHIPPING_OPTIONS: ShippingOption[] = [
  { provider: 'JNE', service: 'REG', name: 'JNE Reguler', price: 15000, estimatedDays: '2-3 hari', logo: '📦' },
  { provider: 'JNE', service: 'YES', name: 'JNE YES', price: 25000, estimatedDays: '1 hari', logo: '🚀' },
  { provider: 'SiCepat', service: 'REG', name: 'SiCepat Reguler', price: 12000, estimatedDays: '2-3 hari', logo: '✈️' },
  { provider: 'SiCepat', service: 'BEST', name: 'SiCepat BEST', price: 22000, estimatedDays: '1-2 hari', logo: '⚡' },
  { provider: 'J&T', service: 'EZ', name: 'J&T Express', price: 10000, estimatedDays: '2-4 hari', logo: '🚚' },
  { provider: 'AnterAja', service: 'REG', name: 'AnterAja Reguler', price: 9000, estimatedDays: '3-5 hari', logo: '📮' },
  { provider: 'Tiki', service: 'REG', name: 'Tiki Reguler', price: 14000, estimatedDays: '2-3 hari', logo: '📬' },
]

// Default shipping options — used as fallback when shipping calculation API fails
export const DEFAULT_SHIPPING_OPTIONS: ShippingOption[] = [...SHIPPING_OPTIONS]

// ==================== COURIER PROVIDERS CONFIG ====================
// Metadata for all supported courier providers

export interface CourierProviderConfig {
  provider: string
  logo: string
  description: string
  services: {
    service: string
    name: string
    description: string
  }[]
}

export const COURIER_PROVIDERS: CourierProviderConfig[] = [
  {
    provider: 'JNE',
    logo: '📦',
    description: 'Jalur Nugraha Ekakurir — salah satu kurir terbesar di Indonesia',
    services: [
      { service: 'REG', name: 'JNE Reguler', description: 'Layanan reguler JNE, estimasi 2-3 hari' },
      { service: 'YES', name: 'JNE YES (Yakin Esok Sampai)', description: 'Layanan express JNE, estimasi 1 hari' },
    ],
  },
  {
    provider: 'SiCepat',
    logo: '✈️',
    description: 'SiCepat Express — layanan pengiriman cepat dan terpercaya',
    services: [
      { service: 'REG', name: 'SiCepat Reguler', description: 'Layanan reguler SiCepat, estimasi 2-3 hari' },
      { service: 'BEST', name: 'SiCepat BEST (Besok Sampai Tinggal)', description: 'Layanan express SiCepat, estimasi 1-2 hari' },
    ],
  },
  {
    provider: 'J&T',
    logo: '🚚',
    description: 'J&T Express — jaringan pengiriman luas di seluruh Indonesia',
    services: [
      { service: 'EZ', name: 'J&T Express EZ', description: 'Layanan express J&T, estimasi 2-3 hari' },
    ],
  },
  {
    provider: 'AnterAja',
    logo: '📮',
    description: 'AnterAja — solusi pengiriman terjangkau dari Astra',
    services: [
      { service: 'REG', name: 'AnterAja Reguler', description: 'Layanan reguler AnterAja, estimasi 3-5 hari' },
    ],
  },
  {
    provider: 'Tiki',
    logo: '📬',
    description: 'Tiki — Citra Van Titipan Kilat, kurir nasional terpercaya',
    services: [
      { service: 'REG', name: 'Tiki Reguler', description: 'Layanan reguler Tiki, estimasi 2-3 hari' },
    ],
  },
  {
    provider: 'POS Indonesia',
    logo: '🏣',
    description: 'POS Indonesia — layanan pengiriman nasional',
    services: [
      { service: 'KILAT', name: 'POS Kilat Khusus', description: 'Layanan kilat POS Indonesia, estimasi 2-4 hari' },
    ],
  },
]
