import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serializeDecimal } from '@/lib/decimal-utils'

import { logger } from '@/lib/logger'
// GET /api/vouchers - Public endpoint: list active vouchers for display
// Query params:
//   userId: optional - to check if user has already used each voucher
//   No auth required (public browsing)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || undefined

    const now = new Date()

    // Fetch active vouchers within valid date range
    const vouchers = await db.voucher.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    })

    // If userId provided, check usage status for each voucher
    let userUsages: Record<string, number> = {}
    if (userId) {
      const usages = await db.voucherUsage.findMany({
        where: { userId },
        select: { voucherId: true },
      })
      for (const u of usages) {
        userUsages[u.voucherId] = (userUsages[u.voucherId] || 0) + 1
      }
    }

    const data = vouchers.map((v) => {
      const usedCount = userId ? (userUsages[v.id] || 0) : 0
      const remainingUses = v.usageLimit ? Math.max(0, v.usageLimit - v.usageCount) : null
      const userRemainingUses = Math.max(0, v.perUserLimit - usedCount)

      return {
        id: v.id,
        code: v.code,
        name: v.name,
        description: v.description,
        type: v.type,
        value: v.value,
        minPurchase: v.minPurchase,
        maxDiscount: v.maxDiscount,
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
        isAvailable: remainingUses === null || remainingUses > 0,
        userCanUse: userId ? userRemainingUses > 0 && (remainingUses === null || remainingUses > 0) : true,
      }
    })

    return NextResponse.json(serializeDecimal({ success: true, data }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Vouchers GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
