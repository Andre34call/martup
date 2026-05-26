import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'

// OTP configuration for 2FA
const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 5

/**
 * GET /api/user/2fa - Check 2FA status for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const user = await db.user.findUnique({
      where: { id: authResult.user.id },
      select: { twoFactorEnabled: true, phone: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        twoFactorEnabled: user.twoFactorEnabled,
        hasPhone: !!user.phone,
        phone: user.phone ? maskPhone(user.phone) : null,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, '2FA GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/2fa - Enable 2FA or send OTP for 2FA setup
 * Body: { action: 'send-otp' } to send OTP to user's phone
 * Body: { action: 'enable', otpCode: '123456' } to verify OTP and enable 2FA
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const { action, otpCode } = body

    if (!action || !['send-otp', 'enable'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action harus "send-otp" atau "enable"' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: authResult.user.id },
      select: { id: true, phone: true, twoFactorEnabled: true, otpCode: true, otpExpiry: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check that user has a phone number
    if (!user.phone) {
      return NextResponse.json(
        { success: false, error: 'Nomor HP harus diatur terlebih dahulu untuk mengaktifkan 2FA' },
        { status: 400 }
      )
    }

    if (action === 'send-otp') {
      // Rate limit: max 5 OTP requests per user per hour
      if (!checkRateLimit(`2fa-otp:${user.id}`, 5)) {
        return NextResponse.json(
          { success: false, error: 'Terlalu banyak permintaan OTP. Coba lagi dalam 1 jam.' },
          { status: 429 }
        )
      }

      // Generate 6-digit OTP
      const newOtpCode = crypto.randomInt(0, Math.pow(10, OTP_LENGTH)).toString().padStart(OTP_LENGTH, '0')
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

      await db.user.update({
        where: { id: user.id },
        data: { otpCode: newOtpCode, otpExpiry },
      })

      // In production: Send OTP via SMS gateway
      logger.info({ phone: maskPhone(user.phone) }, `[2FA] OTP sent (expires in ${OTP_EXPIRY_MINUTES} min)`)

      const isDev = process.env.NODE_ENV === 'development'

      return NextResponse.json({
        success: true,
        message: `Kode OTP telah dikirim ke ${maskPhone(user.phone)}`,
        ...(isDev ? { devOtp: newOtpCode } : {}),
      })
    }

    if (action === 'enable') {
      // Verify OTP code
      if (!otpCode || typeof otpCode !== 'string' || !/^\d{6}$/.test(otpCode)) {
        return NextResponse.json(
          { success: false, error: 'Kode OTP harus 6 digit angka' },
          { status: 400 }
        )
      }

      // Rate limit OTP verification attempts
      if (!checkRateLimit(`2fa-verify:${user.id}`, 10)) {
        return NextResponse.json(
          { success: false, error: 'Terlalu banyak percobaan verifikasi. Coba lagi dalam 1 menit.' },
          { status: 429 }
        )
      }

      // Check if user already has 2FA enabled
      if (user.twoFactorEnabled) {
        return NextResponse.json(
          { success: false, error: '2FA sudah diaktifkan' },
          { status: 400 }
        )
      }

      // Verify OTP exists and hasn't expired
      if (!user.otpCode || !user.otpExpiry) {
        return NextResponse.json(
          { success: false, error: 'Kode OTP belum dikirim. Silakan request ulang.' },
          { status: 400 }
        )
      }

      if (new Date() > user.otpExpiry) {
        // Clear expired OTP
        await db.user.update({
          where: { id: user.id },
          data: { otpCode: null, otpExpiry: null },
        })
        return NextResponse.json(
          { success: false, error: 'Kode OTP sudah kadaluarsa. Silakan request ulang.' },
          { status: 401 }
        )
      }

      // Timing-safe comparison
      const isOtpValid = crypto.timingSafeEqual(
        Buffer.from(otpCode),
        Buffer.from(user.otpCode)
      )

      if (!isOtpValid) {
        return NextResponse.json(
          { success: false, error: 'Kode OTP salah. Silakan coba lagi.' },
          { status: 401 }
        )
      }

      // OTP is valid — enable 2FA
      await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          otpCode: null,
          otpExpiry: null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Two-Factor Authentication berhasil diaktifkan!',
        data: { twoFactorEnabled: true },
      })
    }

    // Should not reach here
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, '2FA POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/2fa - Disable 2FA (requires current password)
 * Body: { password: 'currentPassword' }
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Rate limit
    if (!checkRateLimit(`2fa-disable:${authResult.user.id}`, 5)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password saat ini wajib diisi' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: authResult.user.id },
      select: { id: true, twoFactorEnabled: true, password: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { success: false, error: '2FA tidak aktif' },
        { status: 400 }
      )
    }

    // Verify current password
    if (!user.password) {
      // OAuth-only user — they should set a password first
      return NextResponse.json(
        { success: false, error: 'Akun ini tidak memiliki password. Atur password terlebih dahulu.' },
        { status: 400 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Password salah' },
        { status: 401 }
      )
    }

    // Disable 2FA
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false },
    })

    return NextResponse.json({
      success: true,
      message: 'Two-Factor Authentication berhasil dinonaktifkan',
      data: { twoFactorEnabled: false },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, '2FA DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}

/**
 * Mask phone number for display
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return phone
  const visibleStart = digits.slice(0, 4)
  const visibleEnd = digits.slice(-3)
  const maskedMiddle = '*'.repeat(Math.min(digits.length - 7, 4))
  if (digits.startsWith('62')) {
    return `+62 ${digits.slice(2, 4)}${maskedMiddle}${visibleEnd}`
  }
  if (digits.startsWith('0')) {
    return `0${digits.slice(1, 3)}${maskedMiddle}${visibleEnd}`
  }
  return `${visibleStart}${maskedMiddle}${visibleEnd}`
}
