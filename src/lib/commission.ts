// ==================== PLATFORM SETTINGS UTILITY ====================
// Shared business logic for reading platform settings (commission, fees).
// Used by order creation, wallet/debit, payment/notification, and checkout.

import { db } from '@/lib/db'
import { PrismaClient } from '@prisma/client'

/** Default platform fee per order (IDR) — used when PlatformSetting is not configured */
export const DEFAULT_PLATFORM_FEE = 1000

/**
 * Read the platform-wide commission rate from PlatformSetting table.
 * Returns null if not found or invalid.
 */
async function getPlatformCommissionRate(): Promise<number | null> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: 'platform_settings' } })
    if (row) {
      const settings = JSON.parse(row.value) as Record<string, number | boolean | string>
      if (typeof settings.commissionRate === 'number' && settings.commissionRate >= 0 && settings.commissionRate < 1) {
        return settings.commissionRate
      }
    }
  } catch {
    // Fallback to null
  }
  return null
}

/**
 * Read the platform fee from PlatformSetting table.
 * This is a flat IDR amount per order (e.g., 1000 = Rp 1,000).
 * MUST match what the client displays — the source of truth for buyer-facing prices.
 *
 * Can be called inside a transaction by passing `tx` (Prisma transaction client).
 * Falls back to DEFAULT_PLATFORM_FEE (1000) if not configured.
 */
export async function getPlatformFee(
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<number> {
  try {
    const client = tx || db
    const row = await client.platformSetting.findUnique({ where: { key: 'platform_settings' } })
    if (row) {
      const settings = JSON.parse(row.value) as Record<string, number | boolean | string>
      if (typeof settings.platformFee === 'number' && settings.platformFee >= 0) {
        return Math.floor(settings.platformFee)
      }
    }
  } catch {
    // Fallback to default
  }
  return DEFAULT_PLATFORM_FEE
}

/**
 * Get the effective commission rate for a seller.
 * Priority:
 *   1. Platform-wide commission rate from PlatformSettings
 *   2. Seller's individual commissionRate
 *   3. Default rate (0.05 = 5%)
 */
export async function getEffectiveCommissionRate(
  sellerCommissionRate: number | null | undefined,
  defaultRate: number = 0.05
): Promise<number> {
  const platformRate = await getPlatformCommissionRate()
  if (platformRate !== null) return platformRate

  const sellerRate = Number(sellerCommissionRate)
  if (sellerRate > 0 && sellerRate < 1) return sellerRate

  return defaultRate
}
