import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateAuthToken } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import crypto from 'crypto'

import { logger } from '@/lib/logger'
import { setSessionCookies } from '@/lib/session-cookie'
import { verifyOtpHash } from '@/lib/token-hash'
import { verifyTokenHash } from '@/lib/token-hash'

// Rate limiter: 10 OTP verification attempts per minute per IP
const otpVerifyLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:auth:otp-verify:' })

// Maximum failed OTP attempts before requiring a new OTP code
const MAX_OTP_ATTEMPTS = 5

// POST /api/auth/otp/verify - Verify OTP code and log in the user
export async function POST(request: NextRequest) {
  try {
    // Rate limit: max 10 verification attempts per IP per minute
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await otpVerifyLimiter.check(clientIp)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak percobaan verifikasi. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
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

    // SECURITY: requestId is MANDATORY to bind the OTP send and verify steps.
    // Without it, an attacker who intercepts the OTP code (e.g., via SMS)
    // could verify it without having the requestId that was issued during send.
    if (!requestId || typeof requestId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Request ID wajib diisi. Silakan request OTP ulang.' },
        { status: 400 }
      )
    }

    // Normalize phone: convert all formats (+62..., 62..., 0...) to a canonical form
    // This handles the mismatch where client sends "+62812..." but DB stores "0812..."
    const strippedPhone = phone.replace(/[\s-]/g, '')
    let normalizedPhone = strippedPhone
    if (strippedPhone.startsWith('+62')) {
      normalizedPhone = '0' + strippedPhone.slice(3)
    } else if (strippedPhone.startsWith('62') && !strippedPhone.startsWith('0')) {
      normalizedPhone = '0' + strippedPhone.slice(2)
    }

    // Find user by phone — try both canonical forms (+62 and 0 prefix)
    // to match regardless of how the phone was stored in the DB
    const phoneVariants = [
      normalizedPhone,         // 08123456789
      strippedPhone,           // +628123456789 or as-is
    ]
    // Also add +62 variant if we have 0-prefix
    if (normalizedPhone.startsWith('0')) {
      phoneVariants.push('+62' + normalizedPhone.slice(1))  // +628123456789
      phoneVariants.push('62' + normalizedPhone.slice(1))   // 628123456789
    }

    const user = await db.user.findFirst({
      where: {
        phone: { in: phoneVariants.filter((v, i, a) => a.indexOf(v) === i) } // unique variants
      },
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
        data: { otpCode: null, otpExpiry: null, failedLoginAttempts: 0 },
      })
      return NextResponse.json(
        { success: false, error: 'Kode OTP sudah kadaluarsa. Silakan request ulang.' },
        { status: 401 }
      )
    }

    // SECURITY: Validate requestId to bind send and verify steps
    // This prevents someone who intercepts an OTP code from verifying it
    // without also having the requestId that was issued during the send step
    try {
      const decoded = Buffer.from(requestId, 'base64url').toString()
      const parts = decoded.split(':')
      if (parts.length < 3) {
        logger.warn({ component: 'otp', phone: normalizedPhone }, 'OTP verify: requestId has invalid format')
        return NextResponse.json(
          { success: false, error: 'Request ID tidak valid. Silakan request OTP ulang.' },
          { status: 401 }
        )
      }
      const [requestUserId, timestamp, hmac] = parts
      // Verify the userId matches the user
      if (requestUserId !== user.id) {
        logger.warn({ component: 'otp', phone: normalizedPhone, requestUserId }, 'OTP verify: requestId userId mismatch')
        return NextResponse.json(
          { success: false, error: 'Kode OTP salah atau sudah kadaluarsa' },
          { status: 401 }
        )
      }
      // Verify the HMAC signature
      const secret = process.env.NEXTAUTH_SECRET || process.env.TOKEN_SECRET
      if (!secret) {
        logger.error({ component: 'otp' }, 'No NEXTAUTH_SECRET or TOKEN_SECRET configured — cannot verify requestId')
        return NextResponse.json(
          { success: false, error: 'Server configuration error' },
          { status: 500 }
        )
      }
      const expectedHmac = crypto.createHmac('sha256', secret)
        .update(`${requestUserId}:${otpCode}`)
        .digest('hex').slice(0, 16)
      if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
        logger.warn({ component: 'otp', phone: normalizedPhone }, 'OTP verify: requestId HMAC mismatch')
        return NextResponse.json(
          { success: false, error: 'Kode OTP salah atau sudah kadaluarsa' },
          { status: 401 }
        )
      }
    } catch (e) {
      logger.warn({ component: 'otp', err: e }, 'OTP verify: failed to parse requestId')
      return NextResponse.json(
        { success: false, error: 'Request ID tidak valid. Silakan request OTP ulang.' },
        { status: 401 }
      )
    }

    // Verify OTP code against stored hash (timing-safe)
    const isOtpValid = verifyOtpHash(otpCode, user.otpCode)

    if (!isOtpValid) {
      // SECURITY: Track failed OTP attempts to prevent brute-force
      const newFailedAttempts = (user.failedLoginAttempts || 0) + 1
      if (newFailedAttempts >= MAX_OTP_ATTEMPTS) {
        // Too many failed attempts — invalidate the OTP and require a new one
        await db.user.update({
          where: { id: user.id },
          data: {
            otpCode: null,
            otpExpiry: null,
            failedLoginAttempts: 0, // Reset after lockout
          },
        })
        logger.warn({ component: 'otp', userId: user.id }, `OTP invalidated after ${MAX_OTP_ATTEMPTS} failed attempts`)
        return NextResponse.json(
          { success: false, error: `Terlalu banyak percobaan salah. Kode OTP telah dinonaktifkan. Silakan request OTP baru.` },
          { status: 401 }
        )
      }

      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: newFailedAttempts },
      })

      const remaining = MAX_OTP_ATTEMPTS - newFailedAttempts
      return NextResponse.json(
        { success: false, error: `Kode OTP salah. Sisa percobaan: ${remaining}` },
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
        failedLoginAttempts: 0, // Reset on successful verification
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
