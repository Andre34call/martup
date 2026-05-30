import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit } from '@/lib/auth-middleware'
import { authLimiter } from '@/lib/rate-limit'
import crypto from 'crypto'

import { logger } from '@/lib/logger'
import { sendOTP } from '@/lib/sms-gateway'
import { hashOtp } from '@/lib/token-hash'
// OTP configuration
const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 5
const OTP_MAX_ATTEMPTS_PER_HOUR = 5

// POST /api/auth/otp/send - Send OTP to a phone number
// Generates a 6-digit OTP, stores it in the user record, and returns a requestId
// In production, this would send the OTP via SMS gateway
export async function POST(request: NextRequest) {
  try {
    // Rate limit: max 5 OTP requests per phone per hour
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`otp-send:${clientIp}`, OTP_MAX_ATTEMPTS_PER_HOUR)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan OTP. Coba lagi dalam 1 jam.' },
        { status: 429 }
      )
    }
    // Also use distributed rate limiter (persists across serverless cold starts)
    const distLimit = await authLimiter.check(`otp-send:${clientIp}`)
    if (!distLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan OTP. Coba lagi dalam beberapa menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { phone } = body

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Nomor HP wajib diisi' },
        { status: 400 }
      )
    }

    // Validate phone format (Indonesian)
    const normalizedPhone = phone.replace(/[\s-]/g, '')
    if (!/^(0|\+62|62)\d{9,12}$/.test(normalizedPhone)) {
      return NextResponse.json(
        { success: false, error: 'Format nomor HP tidak valid' },
        { status: 400 }
      )
    }

    // SECURITY: Per-phone rate limit in addition to per-IP limit
    // Prevents attackers using proxy rotation from spamming a victim's phone
    if (!checkRateLimit(`otp-send-phone:${normalizedPhone}`, OTP_MAX_ATTEMPTS_PER_HOUR)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan OTP ke nomor ini. Coba lagi dalam 1 jam.' },
        { status: 429 }
      )
    }

    // Generate 6-digit OTP
    const otpCode = crypto.randomInt(0, Math.pow(10, OTP_LENGTH)).toString().padStart(OTP_LENGTH, '0')

    // Set expiry time
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    // Find or create user with this phone number
    let user = await db.user.findFirst({
      where: { phone: normalizedPhone },
    })

    if (user) {
      // Check if user is blocked
      if (!user.isActive) {
        return NextResponse.json(
          { success: false, error: 'Akun Anda telah diblokir. Hubungi admin.' },
          { status: 403 }
        )
      }

      // Update existing user's OTP (store hashed)
      await db.user.update({
        where: { id: user.id },
        data: {
          otpCode: hashOtp(otpCode),
          otpExpiry,
        },
      })
    } else {
      // Create new user with OTP (will be completed after verification)
      // Use a UUID-based internal email to avoid collisions with real emails
      // and to make it clear these are system-generated accounts
      const phoneDigits = normalizedPhone.replace(/\D/g, '')
      const shortId = crypto.randomBytes(6).toString('hex')
      const internalEmail = `otp_${phoneDigits}_${shortId}@martup.internal`
      try {
        user = await db.user.create({
          data: {
            email: internalEmail,
            phone: normalizedPhone,
            name: 'New Member',
            role: 'buyer',
            isVerified: false,
            otpCode: hashOtp(otpCode),
            otpExpiry,
            wallet: {
              create: {
                balance: 0,
                holdBalance: 0,
              },
            },
          },
        })
      } catch (createError: any) {
        // Handle unique constraint violation on phone field
        if (createError?.code === 'P2002' && createError?.meta?.target?.includes('phone')) {
          return NextResponse.json(
            { success: false, error: 'Nomor HP sudah terdaftar. Silakan login dengan nomor HP tersebut.' },
            { status: 409 }
          )
        }
        throw createError
      }
    }

    // Generate a verification request ID (HMAC-signed to prevent tampering)
    const requestId = Buffer.from(
      `${user.id}:${Date.now()}:${crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET || 'dev-secret').update(`${user.id}:${otpCode}`).digest('hex').slice(0, 16)}`
    ).toString('base64url')

    // Send OTP via configured SMS gateway (mock/twilio/fonnte)
    const smsResult = await sendOTP(normalizedPhone, otpCode, OTP_EXPIRY_MINUTES)
    if (smsResult.success) {
      logger.info(
        { component: 'otp', provider: smsResult.provider, messageId: smsResult.messageId, phone: normalizedPhone },
        `[OTP] Code sent to ${normalizedPhone} via ${smsResult.provider}`
      )
    } else {
      logger.warn(
        { component: 'otp', provider: smsResult.provider, error: smsResult.error, phone: normalizedPhone },
        `[OTP] Failed to send code to ${normalizedPhone} via ${smsResult.provider}: ${smsResult.error}`
      )
    }

    const isDev = process.env.NODE_ENV === 'development'

    return NextResponse.json({
      success: true,
      message: `Kode OTP telah dikirim ke ${maskPhone(normalizedPhone)}`,
      requestId,
      // Only include OTP in development for testing
      ...(isDev ? { devOtp: otpCode } : {}),
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'OTP send error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}

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
