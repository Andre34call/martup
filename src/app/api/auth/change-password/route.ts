import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { validateBody, updatePasswordSchema } from '@/lib/validations'

/**
 * POST /api/auth/change-password - Change password for authenticated email/password users.
 *
 * Requires:
 * - currentPassword: The user's current password
 * - newPassword: The new password (must meet complexity requirements)
 * - confirmPassword: Must match newPassword
 *
 * After changing the password, tokenVersion is incremented to invalidate
 * all existing sessions on other devices. The current session is also
 * invalidated — the user must re-login.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)

    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // Get the user with their password hash
    const user = await db.user.findUnique({
      where: { id: authResult.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        tokenVersion: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Pengguna tidak ditemukan' },
        { status: 404 }
      )
    }

    // OAuth-only users (no password) cannot use this endpoint
    if (!user.password) {
      return NextResponse.json(
        { success: false, error: 'Akun ini terdaftar melalui Google. Gunakan fitur "Lupa Password" untuk mengatur password.' },
        { status: 400 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validation = validateBody(updatePasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword, confirmPassword } = validation.data

    // Check that new password matches confirmation
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Password baru dan konfirmasi tidak cocok' },
        { status: 400 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Password saat ini salah' },
        { status: 401 }
      )
    }

    // Check that new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) {
      return NextResponse.json(
        { success: false, error: 'Password baru harus berbeda dari password saat ini' },
        { status: 400 }
      )
    }

    // Hash the new password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

    // Update password and increment tokenVersion to invalidate all sessions
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
        // Clear any pending reset tokens (user changed password directly)
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    })

    logger.info({ component: 'auth', userId: user.id }, 'Password changed successfully — all sessions invalidated')

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diubah. Silakan login kembali dengan password baru.',
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Change password error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
