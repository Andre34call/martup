import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'

import { logger } from '@/lib/logger'
// GET /api/admin/vouchers - List all vouchers with usage stats
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const vouchers = await db.voucher.findMany({
      include: {
        _count: {
          select: { usages: true },
        },
        seller: {
          select: { storeName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const mapped = vouchers.map((v) => ({
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
      perUserLimit: v.perUserLimit,
      sellerId: v.sellerId,
      sellerStoreName: v.seller?.storeName ?? null,
      validFrom: v.validFrom,
      validUntil: v.validUntil,
      isActive: v.isActive,
      totalUsages: v._count.usages,
      createdAt: v.createdAt,
    }))

    return NextResponse.json(serializeDecimal({ success: true, data: mapped }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin vouchers GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/admin/vouchers - Create voucher
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const {
      code,
      name,
      description,
      type,
      value,
      minPurchase,
      maxDiscount,
      usageLimit,
      perUserLimit,
      validFrom,
      validUntil,
      isActive,
    } = body

    if (!code || !name || !type || value === undefined || !validFrom || !validUntil) {
      return NextResponse.json(
        {
          success: false,
          error: 'code, name, type, value, validFrom, validUntil are required',
        },
        { status: 400 }
      )
    }

    if (!['percentage', 'fixed'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be "percentage" or "fixed"' },
        { status: 400 }
      )
    }

    // Check code uniqueness
    const existing = await db.voucher.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Voucher code already exists' },
        { status: 409 }
      )
    }

    const voucher = await db.voucher.create({
      data: {
        code: code.toUpperCase(),
        name,
        description: description || null,
        type,
        value: parseFloat(String(value)),
        minPurchase: minPurchase ? parseFloat(String(minPurchase)) : 0,
        maxDiscount: maxDiscount ? parseFloat(String(maxDiscount)) : null,
        usageLimit: usageLimit ? parseInt(String(usageLimit), 10) : null,
        perUserLimit: perUserLimit ? parseInt(String(perUserLimit), 10) : 1,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json(serializeDecimal({ success: true, data: voucher }), { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin vouchers POST error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/vouchers - Update voucher
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const {
      voucherId,
      code,
      name,
      description,
      type,
      value,
      minPurchase,
      maxDiscount,
      usageLimit,
      perUserLimit,
      validFrom,
      validUntil,
      isActive,
    } = body

    if (!voucherId) {
      return NextResponse.json(
        { success: false, error: 'voucherId is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (code !== undefined) updateData.code = code.toUpperCase()
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (type !== undefined) updateData.type = type
    if (value !== undefined) updateData.value = parseFloat(String(value))
    if (minPurchase !== undefined)
      updateData.minPurchase = parseFloat(String(minPurchase))
    if (maxDiscount !== undefined)
      updateData.maxDiscount = maxDiscount ? parseFloat(String(maxDiscount)) : null
    if (usageLimit !== undefined)
      updateData.usageLimit = usageLimit ? parseInt(String(usageLimit), 10) : null
    if (perUserLimit !== undefined)
      updateData.perUserLimit = parseInt(String(perUserLimit), 10)
    if (validFrom !== undefined) updateData.validFrom = new Date(validFrom)
    if (validUntil !== undefined) updateData.validUntil = new Date(validUntil)
    if (isActive !== undefined) updateData.isActive = isActive

    const voucher = await db.voucher.update({
      where: { id: voucherId },
      data: updateData,
    })

    return NextResponse.json(serializeDecimal({ success: true, data: voucher }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin vouchers PUT error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/vouchers - Delete voucher
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const { voucherId } = body

    if (!voucherId) {
      return NextResponse.json(
        { success: false, error: 'voucherId is required' },
        { status: 400 }
      )
    }

    // Delete related usages first
    await db.voucherUsage.deleteMany({ where: { voucherId } })

    const voucher = await db.voucher.delete({
      where: { id: voucherId },
    })

    return NextResponse.json(serializeDecimal({ success: true, data: voucher }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin vouchers DELETE error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
