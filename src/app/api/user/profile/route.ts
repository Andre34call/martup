import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// ==================== PUT /api/user/profile ====================
// Update user profile fields: name, email, phone, emailHidden
// All fields are optional — only provided fields are updated.

export async function PUT(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Rate limit: 10 updates per minute per user
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(`profile-update:${authResult.user.id}:${clientIp}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email, phone, emailHidden } = body

    // Build update data — only include fields that are provided
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Nama tidak boleh kosong' },
          { status: 400 }
        )
      }
      if (name.trim().length > 100) {
        return NextResponse.json(
          { success: false, error: 'Nama terlalu panjang (maks 100 karakter)' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || email.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Email tidak boleh kosong' },
          { status: 400 }
        )
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { success: false, error: 'Format email tidak valid' },
          { status: 400 }
        )
      }
      // Check if email is already taken by another user
      const existingUser = await db.user.findUnique({
        where: { email: email.trim() },
        select: { id: true },
      })
      if (existingUser && existingUser.id !== authResult.user.id) {
        return NextResponse.json(
          { success: false, error: 'Email sudah digunakan oleh akun lain' },
          { status: 409 }
        )
      }
      updateData.email = email.trim()
    }

    if (phone !== undefined) {
      if (typeof phone !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Format nomor telepon tidak valid' },
          { status: 400 }
        )
      }
      // Allow empty phone (user wants to remove it)
      if (phone.trim() && !phone.trim().startsWith('+') && !phone.trim().startsWith('0')) {
        return NextResponse.json(
          { success: false, error: 'Nomor telepon harus dimulai dengan + atau 0' },
          { status: 400 }
        )
      }
      // Check if phone is already taken by another user
      if (phone.trim()) {
        const existingPhone = await db.user.findUnique({
          where: { phone: phone.trim() },
          select: { id: true },
        })
        if (existingPhone && existingPhone.id !== authResult.user.id) {
          return NextResponse.json(
            { success: false, error: 'Nomor telepon sudah digunakan oleh akun lain' },
            { status: 409 }
          )
        }
      }
      updateData.phone = phone.trim() || null
    }

    if (emailHidden !== undefined) {
      if (typeof emailHidden !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'emailHidden harus berupa boolean' },
          { status: 400 }
        )
      }
      updateData.emailHidden = emailHidden
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada data yang diperbarui' },
        { status: 400 }
      )
    }

    // Update user in database
    const updatedUser = await db.user.update({
      where: { id: authResult.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        avatar: true,
        role: true,
        isVerified: true,
        loyaltyPoints: true,
        coins: true,
        referralCode: true,
        twoFactorEnabled: true,
        emailHidden: true,
      },
    })

    logger.info(
      { userId: authResult.user.id, updatedFields: Object.keys(updateData) },
      'User profile updated'
    )

    return NextResponse.json({
      success: true,
      data: updatedUser,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Profile update error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
