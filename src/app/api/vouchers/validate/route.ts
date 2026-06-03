import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'

const voucherValidateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:vouchers:validate:' })

import { logger } from '@/lib/logger'
// POST /api/vouchers/validate - Validate a voucher code (PREVIEW only)
// Body: { code, userId, cartSubtotal, sellerId? }
// Requires authentication
// SECURITY (SG-7): This endpoint is a PREVIEW — it does NOT consume the voucher.
// Actual voucher consumption (VoucherUsage creation + usageCount increment) happens in
// /api/orders POST, which uses a transaction for atomicity. A post-increment check there
// ensures usageLimit cannot be exceeded even under race conditions.
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Rate limit: max 10 per minute per user
    const rateLimit = await voucherValidateLimiter.check(authResult.user.id)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.`,
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { code, userId, cartSubtotal, sellerId } = body

    // Validate required fields
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        {
          success: true,
          data: {
            valid: false,
            message: 'Kode voucher harus diisi',
          },
        },
        { status: 200 }
      )
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        {
          success: true,
          data: {
            valid: false,
            message: 'User ID harus diisi',
          },
        },
        { status: 200 }
      )
    }

    if (cartSubtotal === undefined || cartSubtotal === null || typeof cartSubtotal !== 'number' || cartSubtotal < 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            valid: false,
            message: 'Subtotal keranjang tidak valid',
          },
        },
        { status: 200 }
      )
    }

    // Ensure the authenticated user matches the requested userId
    if (authResult.user.id !== userId) {
      return NextResponse.json(
        {
          success: true,
          data: {
            valid: false,
            message: 'User tidak terautentikasi',
          },
        },
        { status: 200 }
      )
    }

    // Look up voucher by code (case-insensitive)
    const voucher = await db.voucher.findFirst({
      where: {
        code: {
          equals: code,
          mode: 'insensitive',
        },
      },
    })

    // 1. Voucher exists and isActive
    if (!voucher) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          message: 'Kode voucher tidak ditemukan',
        },
      })
    }

    if (!voucher.isActive) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          message: 'Voucher sudah tidak aktif',
        },
      })
    }

    // 2. Voucher is within valid date range
    const now = new Date()
    if (now < voucher.validFrom) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          message: 'Voucher belum berlaku',
        },
      })
    }

    if (now > voucher.validUntil) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          message: 'Voucher sudah kadaluarsa',
        },
      })
    }

    // 3. Cart subtotal meets minPurchase requirement
    if (cartSubtotal < Number(voucher.minPurchase)) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          message: `Minimum pembelian Rp ${Number(voucher.minPurchase).toLocaleString('id-ID')} untuk menggunakan voucher ini`,
        },
      })
    }

    // 4. Voucher usageLimit not exceeded (if set)
    if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          message: 'Voucher sudah melewati batas penggunaan',
        },
      })
    }

    // 5. User has not exceeded perUserLimit (check VoucherUsage table)
    const userUsageCount = await db.voucherUsage.count({
      where: {
        voucherId: voucher.id,
        userId: userId,
      },
    })

    if (userUsageCount >= voucher.perUserLimit) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          message: 'Anda sudah menggunakan voucher ini sebanyak maksimum yang diperbolehkan',
        },
      })
    }

    // 6. If voucher has sellerId, cart must contain items from that seller
    if (voucher.sellerId && sellerId !== voucher.sellerId) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          message: 'Voucher ini hanya berlaku untuk produk dari toko tertentu',
        },
      })
    }

    // Calculate discount amount (convert Decimal to number for arithmetic)
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

    // Ensure discount doesn't exceed cart subtotal
    if (discountAmount > cartSubtotal) {
      discountAmount = cartSubtotal
    }

    // Round to integer (Indonesian Rupiah)
    discountAmount = Math.floor(discountAmount)

    const voucherDetails = {
      id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      description: voucher.description,
      type: voucher.type,
      value: Number(voucher.value),
      minPurchase: Number(voucher.minPurchase),
      maxDiscount: voucher.maxDiscount !== null ? Number(voucher.maxDiscount) : null,
      perUserLimit: voucher.perUserLimit,
      sellerId: voucher.sellerId,
      validFrom: voucher.validFrom,
      validUntil: voucher.validUntil,
    }

    // SECURITY (SG-7): Warn if usage is near the limit to reduce race-condition surprises
    const nearLimitWarning = voucher.usageLimit !== null && (voucher.usageLimit - voucher.usageCount) <= 3
      ? `Perhatian: Sisa penggunaan voucher ini hampir habis (${voucher.usageLimit - voucher.usageCount} tersisa). Berlaku siapa cepat dia dapat.`
      : undefined

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        voucher: voucherDetails,
        discountAmount,
        message: 'Voucher berhasil diterapkan!',
        ...(nearLimitWarning ? { warning: nearLimitWarning } : {}),
      },
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Voucher validate POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// GET /api/vouchers/validate - List available vouchers for a user
// Query params: userId (required), sellerId (optional, for seller-specific vouchers)
// Requires authentication
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const sellerId = searchParams.get('sellerId') || undefined

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // Ensure the authenticated user matches the requested userId
    if (authResult.user.id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - User ID mismatch' },
        { status: 403 }
      )
    }

    const now = new Date()

    // Build where clause: active, within date range, and either platform voucher or matching seller
    const whereClause: Record<string, unknown> = {
      isActive: true,
      validFrom: { lte: now },
      validUntil: { gte: now },
      OR: [
        { sellerId: null }, // Platform vouchers
        ...(sellerId ? [{ sellerId }] : []), // Seller-specific vouchers (if sellerId provided)
      ],
    }

    const vouchers = await db.voucher.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    })

    // Get user's usage counts for these vouchers
    const voucherIds = vouchers.map((v) => v.id)
    const usages = await db.voucherUsage.findMany({
      where: {
        userId,
        voucherId: { in: voucherIds },
      },
      select: { voucherId: true },
    })

    const userUsages: Record<string, number> = {}
    for (const u of usages) {
      userUsages[u.voucherId] = (userUsages[u.voucherId] || 0) + 1
    }

    const data = vouchers.map((v) => {
      const usedCount = userUsages[v.id] || 0
      const remainingUses = v.usageLimit ? Math.max(0, v.usageLimit - v.usageCount) : null
      const userRemainingUses = Math.max(0, v.perUserLimit - usedCount)
      const isAvailable = (remainingUses === null || remainingUses > 0) && userRemainingUses > 0

      return {
        id: v.id,
        code: v.code,
        name: v.name,
        description: v.description,
        type: v.type,
        value: Number(v.value),
        minPurchase: Number(v.minPurchase),
        maxDiscount: v.maxDiscount !== null ? Number(v.maxDiscount) : null,
        usageLimit: v.usageLimit,
        usageCount: v.usageCount,
        remainingUses,
        perUserLimit: v.perUserLimit,
        userUsedCount: usedCount,
        userRemainingUses,
        sellerId: v.sellerId,
        validFrom: v.validFrom,
        validUntil: v.validUntil,
        isActive: v.isActive,
        isAvailable,
        userCanUse: isAvailable,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Voucher validate GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
