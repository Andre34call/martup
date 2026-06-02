import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateAuthToken } from '@/lib/auth-middleware'
import { sensitiveLimiter } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { logger } from '@/lib/logger'
import { setSessionCookies } from '@/lib/session-cookie'

/** Timing-safe string comparison to prevent timing attacks */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

// POST /api/admin/init - Create the first admin user
// SECURITY: This endpoint ONLY works when NO admin exists in the database.
// Once an admin exists, this endpoint is permanently disabled.
// Requires ADMIN_SETUP_SECRET env var for authentication.
export async function POST(request: NextRequest) {
  try {
    // Rate limit - very strict (2 per minute, distributed)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitResult = await sensitiveLimiter.check(`admin-init:${clientIp}`)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    // SECURITY: Check if any admin already exists
    const adminCount = await db.user.count({ where: { role: 'admin', isActive: true } })
    if (adminCount > 0) {
      return NextResponse.json(
        { success: false, error: 'Admin sudah ada. Gunakan /api/admin/setup untuk mempromosikan user lain.' },
        { status: 403 }
      )
    }

    // Verify the setup secret
    const body = await request.json()
    const { secret, email, password, name } = body

    // Check ADMIN_SETUP_SECRET
    // SECURITY: Do NOT fall back to NEXTAUTH_SECRET — that would allow anyone
    // with knowledge of NEXTAUTH_SECRET (e.g. OAuth flows) to create admin accounts.
    const adminSecret = process.env.ADMIN_SETUP_SECRET
    if (!adminSecret) {
      return NextResponse.json(
        { success: false, error: 'ADMIN_SETUP_SECRET harus diset di environment variables.' },
        { status: 500 }
      )
    }

    if (!secret || !adminSecret || !safeCompare(secret, adminSecret)) {
      logger.warn(`[SECURITY] Invalid admin init attempt from IP: ${clientIp}`)
      return NextResponse.json(
        { success: false, error: 'Secret key tidak valid' },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email dan password wajib diisi' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Format email tidak valid' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password minimal 8 karakter' },
        { status: 400 }
      )
    }

    // Check if user with this email already exists
    const existingUser = await db.user.findUnique({ where: { email } })

    if (existingUser) {
      // Promote existing user to admin
      if (existingUser.role === 'admin') {
        return NextResponse.json(
          { success: false, error: 'User sudah menjadi admin' },
          { status: 409 }
        )
      }

      const saltRounds = 12
      const hashedPassword = await bcrypt.hash(password, saltRounds)

      const updatedUser = await db.user.update({
        where: { id: existingUser.id },
        data: {
          role: 'admin',
          isVerified: true,
          isActive: true,
          password: hashedPassword,
          name: name || existingUser.name,
        },
      })

      logger.info(`[AUDIT] Existing user "${email}" promoted to admin via init endpoint`)

      // Create notification
      await db.notification.create({
        data: {
          userId: updatedUser.id,
          title: 'Selamat! Anda sekarang Admin 🎉',
          content: 'Akun Anda telah dipromosikan menjadi Admin MartUp.',
          type: 'system',
          isRead: false,
        },
      })

      const token = generateAuthToken(updatedUser.id, updatedUser.tokenVersion ?? 0)

      const response = NextResponse.json({
        success: true,
        message: `User "${email}" berhasil dipromosikan menjadi admin!`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          isVerified: updatedUser.isVerified,
        },
        token,
      })
      setSessionCookies(response, token, true) // Remember me for admin
      return response
    }

    // Create new admin user
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const user = await db.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        password: hashedPassword,
        role: 'admin',
        isVerified: true, // Admin is always verified
        isActive: true,
        wallet: {
          create: {
            balance: 0,
            holdBalance: 0,
          },
        },
      },
    })

    logger.info(`[AUDIT] First admin user "${email}" created via init endpoint`)

    // Create welcome notification
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Selamat Datang, Admin! 🎉',
        content: 'Akun admin Anda telah berhasil dibuat. Anda memiliki akses penuh ke panel admin MartUp.',
        type: 'system',
        isRead: false,
      },
    })

    const token = generateAuthToken(user.id, user.tokenVersion ?? 0)

    const response = NextResponse.json({
      success: true,
      message: 'Admin user berhasil dibuat!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
      token,
    })
    setSessionCookies(response, token, true) // Remember me for admin
    return response
  } catch (error: any) {
    logger.error({ err: error }, 'Admin init error')

    // Provide specific error for database connection issues
    const errorMessage = error?.code === 'P1001'
      ? 'Database tidak dapat diakses. Pastikan SUPABASE_DATABASE_URL sudah dikonfigurasi di Vercel.'
      : error?.code === 'P1002'
      ? 'Database connection timeout. Coba lagi dalam beberapa detik.'
      : 'Terjadi kesalahan server. Coba lagi nanti.'

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
