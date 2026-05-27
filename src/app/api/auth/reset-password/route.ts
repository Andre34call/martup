import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'

// POST /api/auth/reset-password
// Resets the user's password using the token from the email
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await authLimiter.check(`reset:${ip}`)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan. Coba lagi dalam beberapa menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { token, password } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token reset tidak valid' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password baru wajib diisi' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password minimal 8 karakter' },
        { status: 400 }
      )
    }
    if (!/[a-zA-Z]/.test(password)) {
      return NextResponse.json(
        { success: false, error: 'Password harus mengandung huruf' },
        { status: 400 }
      )
    }
    if (!/\d/.test(password)) {
      return NextResponse.json(
        { success: false, error: 'Password harus mengandung angka' },
        { status: 400 }
      )
    }

    // Find user by reset token that hasn't expired
    const user = await db.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: { gt: new Date() },
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token reset sudah kedaluwarsa atau tidak valid. Silakan minta link reset baru.' },
        { status: 400 }
      )
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(12)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Update the user's password and clear the reset token
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    })

    logger.info({ component: 'auth', userId: user.id }, 'Password reset successfully')

    return NextResponse.json({
      success: true,
      message: 'Password berhasil direset. Silakan login dengan password baru.',
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Reset password error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
