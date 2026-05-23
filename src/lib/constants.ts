import type { ShippingOption } from './types'

// Shipping options available for checkout
export const SHIPPING_OPTIONS: ShippingOption[] = [
  { provider: 'JNE', service: 'REG', name: 'JNE Reguler', price: 15000, estimatedDays: '2-3 hari', logo: '📦' },
  { provider: 'JNE', service: 'YES', name: 'JNE YES', price: 25000, estimatedDays: '1 hari', logo: '🚀' },
  { provider: 'SiCepat', service: 'REG', name: 'SiCepat Reguler', price: 12000, estimatedDays: '2-3 hari', logo: '✈️' },
  { provider: 'SiCepat', service: 'BEST', name: 'SiCepat BEST', price: 22000, estimatedDays: '1-2 hari', logo: '⚡' },
  { provider: 'J&T', service: 'EZ', name: 'J&T Express', price: 10000, estimatedDays: '2-4 hari', logo: '🚚' },
  { provider: 'AnterAja', service: 'REG', name: 'AnterAja Reguler', price: 9000, estimatedDays: '3-5 hari', logo: '📮' },
  { provider: 'Tiki', service: 'REG', name: 'Tiki Reguler', price: 14000, estimatedDays: '2-3 hari', logo: '📬' },
]
