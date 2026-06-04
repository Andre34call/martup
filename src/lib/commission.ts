// ==================== COMMISSION RATE UTILITY ====================
// Shared business logic for calculating the effective commission rate.
// Used by both order-utils.ts and wallet/debit/route.ts to ensure consistency.

import { db } from '@/lib/db'

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
