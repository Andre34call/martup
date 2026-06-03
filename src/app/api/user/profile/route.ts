import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// Rate limiter: 10 profile updates per minute per user
const profileUpdateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:user:profile:' })

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
    const rateLimit = await profileUpdateLimiter.check(`${authResult.user.id}:${clientIp}`)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email, phone, emailHidden, username } = body

    // Build update data — only include fields that are provided
    const updateData: Record<string, unknown> = {}

    if (username !== undefined) {
      if (typeof username !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Format username tidak valid' },
          { status: 400 }
        )
      }

      const trimmedUsername = username.trim().toLowerCase()

      // Allow setting to empty (removing username)
      if (trimmedUsername === '') {
        return NextResponse.json(
          { success: false, error: 'Username tidak boleh kosong' },
          { status: 400 }
        )
      }

      // Validate username format: 3-20 chars, alphanumeric, underscore, hyphen
      const usernameRegex = /^[a-z0-9_-]{3,20}$/
      if (!usernameRegex.test(trimmedUsername)) {
        return NextResponse.json(
          { success: false, error: 'Username harus 3-20 karakter, hanya huruf kecil, angka, underscore (_), atau strip (-)' },
          { status: 400 }
        )
      }

      // Reserved usernames
      const reservedUsernames = ['admin', 'administrator', 'root', 'system', 'moderator', 'mod', 'support', 'help', 'info', 'martup', 'api', 'null', 'undefined', 'settings', 'profile', 'search', 'stream', 'shop', 'store', 'seller', 'buyer']
      if (reservedUsernames.includes(trimmedUsername)) {
        return NextResponse.json(
          { success: false, error: 'Username ini tidak tersedia (reserved)' },
          { status: 400 }
        )
      }

      // Check 30-day cooldown
      const currentUser = await db.user.findUnique({
        where: { id: authResult.user.id },
        select: { username: true, usernameChangedAt: true },
      })

      if (currentUser?.usernameChangedAt) {
        const lastChange = new Date(currentUser.usernameChangedAt)
        const now = new Date()
        const daysSinceLastChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceLastChange < 30) {
          const remainingDays = Math.ceil(30 - daysSinceLastChange)
          return NextResponse.json(
            { success: false, error: `Username hanya bisa diganti setiap 30 hari. Tunggu ${remainingDays} hari lagi.` },
            { status: 400 }
          )
        }
      }

      // Check if username is already taken (but allow same user keeping their own)
      if (trimmedUsername !== currentUser?.username) {
        const existingUsername = await db.user.findUnique({
          where: { username: trimmedUsername },
          select: { id: true },
        })
        if (existingUsername && existingUsername.id !== authResult.user.id) {
          return NextResponse.json(
            { success: false, error: 'Username sudah digunakan oleh orang lain' },
            { status: 409 }
          )
        }
      }

      updateData.username = trimmedUsername
      updateData.usernameChangedAt = new Date()
    }

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
        username: true,
        usernameChangedAt: true,
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
