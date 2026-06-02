import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, verifyAdmin, authErrorResponse, AuthResult } from '@/lib/auth-middleware'
import { authLimiter } from '@/lib/rate-limit'
import crypto from 'crypto'

import { logger } from '@/lib/logger'

/** Timing-safe string comparison to prevent timing attacks */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}
// POST /api/admin/setup - Promote a user to admin role
// SECURITY: Requires EITHER:
// 1. An existing admin making the request (recommended for production), OR
// 2. The secret key (only for initial setup when no admin exists yet)
// Once at least one admin exists, the secret key method is DISABLED
export async function POST(request: NextRequest) {
  try {
    // Rate limit - very strict for admin setup (2 per minute, distributed)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitResult = await authLimiter.check(`admin-setup:${clientIp}`)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, secret } = body

    // Check if any admin exists in the system
    const adminCount = await db.user.count({ where: { role: 'admin', isActive: true } })
    const hasExistingAdmin = adminCount > 0

    let authResult: AuthResult | null = null

    if (hasExistingAdmin) {
      // SECURITY: If admin(s) already exist, require authenticated admin to promote
      // Secret key method is disabled once at least one admin exists
      const result = await verifyAdmin(request)
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Akses ditolak. Hanya admin yang sudah ada yang bisa mempromosikan user lain. Gunakan panel admin untuk mengubah role user.',
          },
          { status: 403 }
        )
      }
      authResult = result
    } else {
      // No admin exists yet - allow secret key for initial setup ONLY
      const adminSecret = process.env.ADMIN_SETUP_SECRET
      if (!adminSecret) {
        logger.error('[SECURITY] ADMIN_SETUP_SECRET not set in environment!')
        return NextResponse.json(
          { success: false, error: 'Admin setup is not configured. Set ADMIN_SETUP_SECRET env variable.' },
          { status: 500 }
        )
      }

      if (!secret || !adminSecret || !safeCompare(secret, adminSecret)) {
        logger.warn(`[SECURITY] Invalid admin setup attempt from IP: ${clientIp}`)
        return NextResponse.json(
          { success: false, error: 'Secret key tidak valid' },
          { status: 403 }
        )
      }
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email wajib diisi' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
      include: { seller: true, wallet: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: `User dengan email "${email}" tidak ditemukan. User harus register/login terlebih dahulu, baru bisa dipromosikan.` },
        { status: 404 }
      )
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Tidak bisa mempromosikan user yang diblokir/tidak aktif.' },
        { status: 403 }
      )
    }

    // Already admin?
    if (user.role === 'admin') {
      return NextResponse.json({
        success: true,
        message: 'User sudah menjadi admin',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified,
        },
      })
    }

    // Promote to admin
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        role: 'admin',
        isVerified: true,
      },
    })

    // Log the promotion for audit
    const promoter = authResult ? `admin "${authResult.user.email}"` : `secret key from IP: ${clientIp}`
    logger.info(`[AUDIT] User "${email}" promoted to admin by ${promoter}`)

    // Create welcome notification
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Selamat! Anda sekarang Admin 🎉',
        content: 'Akun Anda telah dipromosikan menjadi Admin MartUp. Anda sekarang memiliki akses ke panel admin lengkap.',
        type: 'system',
        isRead: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: `User "${email}" berhasil dipromosikan menjadi admin!`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
      },
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin setup error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
