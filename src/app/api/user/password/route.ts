import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'
import { validateBody, updatePasswordSchema } from '@/lib/validations'

// ==================== POST /api/user/password ====================
// Change the authenticated user's password with full validation

export async function POST(request: NextRequest) {
  try {
    // Step 1: Auth required
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 2: Rate limit — 3 attempts per minute per user
    const rateLimitKey = `password-change:${authResult.user.id}`
    if (!checkRateLimit(rateLimitKey, 3)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan ubah password. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    // Step 3: Parse and validate request body
    const body = await request.json()
    const validation = validateBody(updatePasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { currentPassword, newPassword, confirmPassword } = validation.data

    // New password must match confirmation
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Konfirmasi password tidak cocok' },
        { status: 400 }
      )
    }

    // New password must differ from current password
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { success: false, error: 'Password baru harus berbeda dari password saat ini' },
        { status: 400 }
      )
    }

    // Step 4: Fetch user's current password hash from DB
    const user = await db.user.findUnique({
      where: { id: authResult.user.id },
      select: { id: true, email: true, password: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if user has a password set (OAuth-only users won't have one)
    if (!user.password) {
      return NextResponse.json(
        { success: false, error: 'Akun ini terdaftar melalui Google. Atur password terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Step 5: Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password) as unknown as boolean
    if (!isCurrentPasswordValid) {
      // Security: log failed attempt
      logger.warn({ userId: user.id, email: user.email }, 'Failed password change attempt')
      return NextResponse.json(
        { success: false, error: 'Password saat ini salah' },
        { status: 401 }
      )
    }

    // Step 6: Hash the new password
    const saltRounds = 12
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

    // Step 7: Update user's password in database
    await db.user.update({
      where: { id: authResult.user.id },
      data: { password: hashedNewPassword },
    })

    // Step 8: Log security event
    logger.info({ userId: user.id }, 'Password changed successfully')

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diubah',
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Password change error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
