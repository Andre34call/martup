import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createRateLimiter } from '@/lib/rate-limit'
import crypto from 'crypto'

import { logger } from '@/lib/logger'
import { sendOTP } from '@/lib/sms-gateway'
import { hashOtp } from '@/lib/token-hash'
// OTP configuration
const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 5
const OTP_MAX_ATTEMPTS_PER_HOUR = 5

// Rate limiters for OTP send
const otpSendIpLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: OTP_MAX_ATTEMPTS_PER_HOUR, keyPrefix: 'rl:auth:otp-send-ip:' })
const otpSendPhoneLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: OTP_MAX_ATTEMPTS_PER_HOUR, keyPrefix: 'rl:auth:otp-send-phone:' })
const otpSendUserIdLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: OTP_MAX_ATTEMPTS_PER_HOUR, keyPrefix: 'rl:auth:otp-send-userid:' })

// POST /api/auth/otp/send - Send OTP to a phone number
// Generates a 6-digit OTP, stores it in the user record, and returns a requestId
// In production, this would send the OTP via SMS gateway
//
// SECURITY: Supports two modes:
// 1. Phone-based: User enters their phone number (for phone login)
// 2. UserId-based: Login returns userId (for 2FA flow) — phone is looked up server-side
//    to prevent phone number enumeration via the login endpoint.
export async function POST(request: NextRequest) {
  try {
    // Rate limit: max 5 OTP requests per IP per minute
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const ipRateLimit = await otpSendIpLimiter.check(clientIp)
    if (!ipRateLimit.allowed) {
      const retrySeconds = Math.ceil((ipRateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan OTP. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { phone, userId: bodyUserId } = body

    // SECURITY: Support both phone-based and userId-based OTP send.
    // - Phone-based: Used for phone login (user enters their phone number)
    // - UserId-based: Used for 2FA flow (login returns userId, not phone, to prevent phone enumeration)
    // At least one of phone or userId must be provided.
    if (!phone && !bodyUserId) {
      return NextResponse.json(
        { success: false, error: 'Nomor HP atau User ID wajib diisi' },
        { status: 400 }
      )
    }

    let normalizedPhone = ''
    let user: { id: string; phone: string | null; isActive: boolean; twoFactorEnabled: boolean } | null = null

    if (bodyUserId && !phone) {
      // ========== UserId-based flow (2FA) ==========
      // Look up the user by userId to find their phone number server-side.
      // This prevents phone number enumeration via the login endpoint.
      user = await db.user.findUnique({
        where: { id: bodyUserId },
        select: { id: true, phone: true, isActive: true, twoFactorEnabled: true },
      })

      if (!user) {
        // Don't reveal whether userId exists
        return NextResponse.json({
          success: true,
          message: 'Jika akun terdaftar dengan nomor HP, kode OTP akan dikirim.',
        })
      }

      if (!user.isActive) {
        return NextResponse.json(
          { success: false, error: 'Akun Anda telah diblokir. Hubungi admin.' },
          { status: 403 }
        )
      }

      if (!user.phone) {
        return NextResponse.json(
          { success: false, error: 'Akun ini tidak memiliki nomor HP. Hubungi support.' },
          { status: 400 }
        )
      }

      // Use the phone from the user record
      normalizedPhone = user.phone.replace(/[\s-]/g, '')
      if (normalizedPhone.startsWith('+62')) {
        normalizedPhone = '0' + normalizedPhone.slice(3)
      } else if (normalizedPhone.startsWith('62') && !normalizedPhone.startsWith('0')) {
        normalizedPhone = '0' + normalizedPhone.slice(2)
      }

      // Per-userId rate limit (prevents abuse of 2FA flow)
      const userIdRateLimit = await otpSendUserIdLimiter.check(bodyUserId)
      if (!userIdRateLimit.allowed) {
        const retrySeconds = Math.ceil((userIdRateLimit.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          { success: false, error: `Terlalu banyak permintaan OTP. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
          { status: 429 }
        )
      }
    } else if (phone) {
      // ========== Phone-based flow (phone login) ==========
      // Validate phone format (Indonesian)
      const strippedPhone = phone.replace(/[\s-]/g, '')
      if (!/^(0|\+62|62)\d{9,12}$/.test(strippedPhone)) {
        return NextResponse.json(
          { success: false, error: 'Format nomor HP tidak valid' },
          { status: 400 }
        )
      }

      // Normalize phone to canonical form for rate limiting and lookups
      normalizedPhone = strippedPhone
      if (strippedPhone.startsWith('+62')) {
        normalizedPhone = '0' + strippedPhone.slice(3)
      } else if (strippedPhone.startsWith('62') && !strippedPhone.startsWith('0')) {
        normalizedPhone = '0' + strippedPhone.slice(2)
      }
    }

    // SECURITY: Per-phone rate limit in addition to per-IP limit
    // Prevents attackers using proxy rotation from spamming a victim's phone
    if (normalizedPhone) {
      const phoneRateLimit = await otpSendPhoneLimiter.check(normalizedPhone)
      if (!phoneRateLimit.allowed) {
        const retrySeconds = Math.ceil((phoneRateLimit.resetAt - Date.now()) / 1000)
        return NextResponse.json(
          { success: false, error: `Terlalu banyak permintaan OTP ke nomor ini. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
          { status: 429 }
        )
      }
    }

    // Generate 6-digit OTP
    const otpCode = crypto.randomInt(0, Math.pow(10, OTP_LENGTH)).toString().padStart(OTP_LENGTH, '0')

    // Set expiry time
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    // If user not found by userId lookup, try phone-based lookup
    if (!user && normalizedPhone) {
      // Find user by phone — try all format variants to match regardless of storage format
      const phoneVariants = [
        normalizedPhone,         // 08123456789
        phone.replace(/[\s-]/g, ''), // original format
      ]
      if (normalizedPhone.startsWith('0')) {
        phoneVariants.push('+62' + normalizedPhone.slice(1))  // +628123456789
        phoneVariants.push('62' + normalizedPhone.slice(1))   // 628123456789
      }

      user = await db.user.findFirst({
        where: {
          phone: { in: phoneVariants.filter((v, i, a) => a.indexOf(v) === i) }
        },
        select: { id: true, phone: true, isActive: true, twoFactorEnabled: true },
      })
    }

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
    } else if (normalizedPhone) {
      // SECURITY (SG-8): Don't auto-create user accounts on OTP send.
      // Users must register first via /api/auth/register with their phone number.
      // Return generic message to prevent phone number enumeration.
      logger.info({ component: 'otp', phone: normalizedPhone }, 'OTP requested for unregistered phone — returning generic message')

      // Don't reveal whether the phone is registered
      return NextResponse.json({
        success: true,
        message: `Jika nomor HP terdaftar, kode OTP akan dikirim ke ${maskPhone(normalizedPhone)}`,
      })
    } else {
      // userId lookup found no user — already handled above
      return NextResponse.json({
        success: true,
        message: 'Jika akun terdaftar dengan nomor HP, kode OTP akan dikirim.',
      })
    }

    // Generate a verification request ID (HMAC-signed to prevent tampering)
    const secret = process.env.NEXTAUTH_SECRET || process.env.TOKEN_SECRET
    if (!secret) {
      logger.error({ component: 'otp' }, 'No NEXTAUTH_SECRET or TOKEN_SECRET configured — cannot sign requestId')
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }
    const requestId = Buffer.from(
      `${user.id}:${Date.now()}:${crypto.createHmac('sha256', secret).update(`${user.id}:${otpCode}`).digest('hex').slice(0, 16)}`
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

    return NextResponse.json({
      success: true,
      message: `Kode OTP telah dikirim ke ${maskPhone(normalizedPhone)}`,
      requestId,
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
