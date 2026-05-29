import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { hashToken } from '@/lib/token-hash'
import { validateBody, resetPasswordSchema } from '@/lib/validations'

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
    const validation = validateBody(resetPasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { token, password } = validation.data

    // Find user by reset token that hasn't expired (hash plaintext token to match DB record)
    const user = await db.user.findFirst({
      where: {
        resetPasswordToken: hashToken(token),
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

    // Update the user's password, clear the reset token, and increment tokenVersion to invalidate all existing sessions
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        tokenVersion: { increment: 1 },
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
