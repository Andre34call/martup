import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, generateAuthToken } from '@/lib/auth-middleware'

import { logger } from '@/lib/logger'
import { setSessionCookies } from '@/lib/session-cookie'
import { verifyOtpHash } from '@/lib/token-hash'
// POST /api/auth/otp/verify - Verify OTP code and log in the user
export async function POST(request: NextRequest) {
  try {
    // Rate limit: max 10 verification attempts per IP per minute
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`otp-verify:${clientIp}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan verifikasi. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { phone, otpCode, requestId } = body

    // Validate required fields
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Nomor HP wajib diisi' },
        { status: 400 }
      )
    }

    if (!otpCode || typeof otpCode !== 'string' || !/^\d{6}$/.test(otpCode)) {
      return NextResponse.json(
        { success: false, error: 'Kode OTP harus 6 digit angka' },
        { status: 400 }
      )
    }

    const normalizedPhone = phone.replace(/[\s-]/g, '')

    // Find user by phone
    const user = await db.user.findFirst({
      where: { phone: normalizedPhone },
      include: {
        seller: true,
        wallet: true,
      },
    })

    if (!user) {
      // Don't reveal whether phone exists
      return NextResponse.json(
        { success: false, error: 'Kode OTP salah atau sudah kadaluarsa' },
        { status: 401 }
      )
    }

    // Check if user is blocked
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Akun Anda telah diblokir. Hubungi admin.' },
        { status: 403 }
      )
    }

    // Verify OTP code
    if (!user.otpCode || !user.otpExpiry) {
      return NextResponse.json(
        { success: false, error: 'Kode OTP belum dikirim. Silakan request ulang.' },
        { status: 400 }
      )
    }

    // Check OTP expiry
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

    // Verify OTP code against stored hash (timing-safe)
    const isOtpValid = verifyOtpHash(otpCode, user.otpCode)

    if (!isOtpValid) {
      return NextResponse.json(
        { success: false, error: 'Kode OTP salah. Silakan coba lagi.' },
        { status: 401 }
      )
    }

    // OTP is valid - clear it and mark user as verified
    await db.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiry: null,
        isVerified: true,
      },
    })

    // Generate auth token (with tokenVersion for session invalidation)
    const token = generateAuthToken(user.id, user.tokenVersion ?? 0)

    // Return user data (without password and OTP)
    const { password: _, otpCode: __, otpExpiry: ___, ...userWithoutSensitive } = user

    // Create welcome notification for new users
    if (user.name === 'New Member' && !user.isVerified) {
      await db.notification.create({
        data: {
          userId: user.id,
          title: 'Selamat Datang di MartUp! 🎉',
          content: 'Terima kasih telah bergabung. Mulai belanja atau jual produk sekarang!',
          type: 'system',
          isRead: false,
        },
      })
    }

    // Fetch complete user data for response
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        isVerified: true,
        isActive: true,
        loyaltyPoints: true,
        coins: true,
        referralCode: true,
        dailyCheckIn: true,
        divisionId: true,
        tokenVersion: true,
        createdAt: true,
        updatedAt: true,
        seller: true,
        wallet: true,
      },
    })

    const resp = NextResponse.json({
      success: true,
      user: fullUser,
      token,
      isNewUser: user.name === 'New Member',
      message: 'Verifikasi OTP berhasil!',
    })
    setSessionCookies(resp, token)
    return resp
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'OTP verify error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
