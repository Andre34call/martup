import { db } from '@/lib/db'

/**
 * Result of voucher validation and discount computation.
 * - `valid: true`  → voucher is usable, `discountAmount` is the server-computed discount
 * - `valid: false` → voucher is not usable, `message` explains why
 */
export interface VoucherValidationResult {
  valid: boolean
  discountAmount?: number
  message?: string
  voucherId?: string
}

/**
 * Reusable server-side voucher validation and discount computation.
 *
 * Used by both:
 * - POST /api/vouchers/validate (pre-check before checkout)
 * - POST /api/orders           (re-validate when creating the order)
 *
 * This function is the SINGLE SOURCE OF TRUTH for voucher rules.
 * The caller should ALWAYS use the returned `discountAmount` and
 * NEVER trust a client-provided discount value.
 *
 * @param voucherId  - The voucher ID (from DB, already resolved by code lookup if needed)
 * @param userId     - The authenticated user placing the order
 * @param cartSubtotal - Subtotal of the cart before discount
 * @param sellerId   - Optional sellerId to check seller-specific vouchers
 */
export async function validateAndComputeVoucherDiscount(
  voucherId: string,
  userId: string,
  cartSubtotal: number,
  sellerId?: string,
): Promise<VoucherValidationResult> {
  // 1. Fetch voucher
  const voucher = await db.voucher.findUnique({ where: { id: voucherId } })

  if (!voucher) {
    return { valid: false, message: 'Voucher tidak ditemukan' }
  }

  // 2. Voucher must be active
  if (!voucher.isActive) {
    return { valid: false, message: 'Voucher sudah tidak aktif' }
  }

  // 3. Voucher must be within valid date range
  const now = new Date()
  if (now < voucher.validFrom) {
    return { valid: false, message: 'Voucher belum berlaku' }
  }
  if (now > voucher.validUntil) {
    return { valid: false, message: 'Voucher sudah kadaluarsa' }
  }

  // 4. Cart subtotal meets minPurchase requirement
  if (cartSubtotal < Number(voucher.minPurchase)) {
    return {
      valid: false,
      message: `Minimum pembelian Rp ${Number(voucher.minPurchase).toLocaleString('id-ID')} untuk menggunakan voucher ini`,
    }
  }

  // 5. Global usage limit not exceeded
  if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit) {
    return { valid: false, message: 'Voucher sudah melewati batas penggunaan' }
  }

  // 6. Per-user usage limit not exceeded
  const userUsageCount = await db.voucherUsage.count({
    where: { voucherId: voucher.id, userId },
  })
  if (userUsageCount >= voucher.perUserLimit) {
    return { valid: false, message: 'Anda sudah menggunakan voucher ini sebanyak maksimum yang diperbolehkan' }
  }

  // 7. If voucher is seller-specific, the order must be for that seller
  if (voucher.sellerId && sellerId !== voucher.sellerId) {
    return { valid: false, message: 'Voucher ini hanya berlaku untuk produk dari toko tertentu' }
  }

  // 8. Compute discount amount (convert Decimal to number for arithmetic)
  let discountAmount = 0
  if (voucher.type === 'percentage') {
    discountAmount = cartSubtotal * (Number(voucher.value) / 100)
    // Apply maxDiscount cap if set
    if (voucher.maxDiscount !== null && discountAmount > Number(voucher.maxDiscount)) {
      discountAmount = Number(voucher.maxDiscount)
    }
  } else if (voucher.type === 'fixed') {
    discountAmount = Number(voucher.value)
  }

  // 9. Discount cannot exceed cart subtotal
  if (discountAmount > cartSubtotal) {
    discountAmount = cartSubtotal
  }

  // 10. Round to integer (Indonesian Rupiah)
  discountAmount = Math.floor(discountAmount)

  return {
    valid: true,
    discountAmount,
    voucherId: voucher.id,
    message: 'Voucher berhasil diterapkan!',
  }
}
