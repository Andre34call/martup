import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { sanitizeInput } from '@/lib/sanitize'

import { logger } from '@/lib/logger'
// PUT /api/addresses/[id] - Update an address (SECURED with verifyAuth)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Unified auth using verifyAuth (supports both session and bearer token)
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const user = authResult.user
    const { id } = await params

    // Rate limit
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`addr-put:${clientIp}:${user.id}`, 15)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const existing = await db.address.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Alamat tidak ditemukan' },
        { status: 404 }
      )
    }
    if (existing.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Anda hanya bisa mengubah alamat sendiri' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      label,
      recipient,
      phone,
      address,
      city,
      province,
      postalCode,
      isDefault,
    } = body as {
      label?: string
      recipient?: string
      phone?: string
      address?: string
      city?: string
      province?: string
      postalCode?: string
      isDefault?: boolean
    }

    // Sanitize text inputs
    const sanitizedData: Record<string, unknown> = {}
    if (label !== undefined) sanitizedData.label = sanitizeInput(label)
    if (recipient !== undefined) sanitizedData.recipient = sanitizeInput(recipient)
    if (phone !== undefined) sanitizedData.phone = sanitizeInput(phone)
    if (address !== undefined) sanitizedData.address = sanitizeInput(address)
    if (city !== undefined) sanitizedData.city = sanitizeInput(city)
    if (province !== undefined) sanitizedData.province = sanitizeInput(province)
    if (postalCode !== undefined) sanitizedData.postalCode = sanitizeInput(postalCode)
    if (isDefault !== undefined) sanitizedData.isDefault = isDefault

    // Validate phone format if provided (Indonesian phone)
    if (phone) {
      const sanitizedPhone = sanitizeInput(phone)
      const phoneDigits = sanitizedPhone.replace(/[^\d+]/g, '')
      if (sanitizedPhone && !/^(0\d{9,14}|\+62\d{9,14})$/.test(phoneDigits)) {
        return NextResponse.json(
          { success: false, error: 'Format nomor telepon tidak valid (gunakan 08xx atau +628xx, 10-15 digit)' },
          { status: 400 }
        )
      }
    }

    // Validate postal code if provided
    if (postalCode) {
      const sanitizedPostal = sanitizeInput(postalCode)
      if (sanitizedPostal && !/^[0-9]{5}$/.test(sanitizedPostal)) {
        return NextResponse.json(
          { success: false, error: 'Kode pos harus 5 digit angka' },
          { status: 400 }
        )
      }
    }

    const updated = await db.$transaction(async (tx) => {
      // If setting as default, unset other defaults
      if (isDefault) {
        await tx.address.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        })
      }

      return tx.address.update({
        where: { id },
        data: sanitizedData,
      })
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'PUT /api/addresses/[id] error')
    return NextResponse.json(
      { success: false, error: 'Gagal mengubah alamat' },
      { status: 500 }
    )
  }
}

// DELETE /api/addresses/[id] - Delete an address (SECURED with verifyAuth)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Unified auth using verifyAuth
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const user = authResult.user
    const { id } = await params

    const existing = await db.address.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Alamat tidak ditemukan' },
        { status: 404 }
      )
    }
    if (existing.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Anda hanya bisa menghapus alamat sendiri' },
        { status: 403 }
      )
    }

    await db.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } })

      // If the deleted address was the default, assign another as default
      if (existing.isDefault) {
        const nextDefault = await tx.address.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        })
        if (nextDefault) {
          await tx.address.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          })
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Alamat berhasil dihapus',
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'DELETE /api/addresses/[id] error')
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus alamat' },
      { status: 500 }
    )
  }
}
