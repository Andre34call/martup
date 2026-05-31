import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateAuthToken, isSuperAdmin } from '@/lib/auth-middleware'
import { authLimiter } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

import { logger } from '@/lib/logger'
import { hashOtp } from '@/lib/token-hash'
import { validateBody, loginSchema } from '@/lib/validations'
import { setSessionCookies } from '@/lib/session-cookie'
import { sendEmail, accountLockedTemplate } from '@/lib/email'

// Helper: check if a string looks like a valid bcrypt hash
function isValidBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash)
}

// OTP configuration for 2FA login
const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 5

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

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 10  // Lock account after 10 failed attempts
const LOCKOUT_DURATION_MINUTES = 30  // Lock for 30 minutes

// POST /api/auth/login - Login with email and password
export async function POST(request: NextRequest) {
  try {
    // Rate limit check — single distributed layer (persists across serverless cold starts)
    // NOTE: The edge middleware (proxy.ts) also enforces a 10 req/min limit per IP as a first line of defense.
    // This distributed limiter provides the authoritative, persistent rate limit.
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const distributedLimit = await authLimiter.check(`login:${clientIp}`)
    if (!distributedLimit.allowed) {
      const retrySeconds = Math.ceil((distributedLimit.resetAt - Date.now()) / 1000)
      // Safety: if retrySeconds is NaN or negative, show a generic message instead of "NaN detik"
      const retryMsg = !Number.isFinite(retrySeconds) || retrySeconds <= 0
        ? 'beberapa saat'
        : retrySeconds > 60
          ? `${Math.ceil(retrySeconds / 60)} menit`
          : `${retrySeconds} detik`
      return NextResponse.json(
        { success: false, error: `Terlalu banyak percobaan login. Coba lagi dalam ${retryMsg}.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validation = validateBody(loginSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { email, password } = validation.data
    const rememberMe = body.rememberMe === true
    logger.info({ email }, 'Login attempt')

    // Find user by email (lowercased by Zod schema)
    // Also try case-insensitive lookup for backward compatibility with existing mixed-case emails
    let user = await db.user.findUnique({
      where: { email },
      include: {
        seller: true,
        wallet: true,
      },
    })

    // Fallback: try case-insensitive lookup for legacy mixed-case emails in the database
    if (!user) {
      user = await db.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: {
          seller: true,
          wallet: true,
        },
      })
      // Auto-normalize the email in the database so future logins use the direct unique lookup
      if (user && user.email !== email) {
        logger.info({ oldEmail: user.email, newEmail: email }, 'Auto-normalizing email to lowercase')
        await db.user.update({
          where: { id: user.id },
          data: { email },
        })
      }
    }

    // User not found
    if (!user) {
      logger.info({ email }, 'Login failed: user not found')
      // Don't reveal whether email exists or not for security
      return NextResponse.json(
        { success: false, error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    logger.info({ email, userId: user.id, hasPassword: !!user.password, isActive: user.isActive, isVerified: user.isVerified }, 'Login: user found')

    // Check if user is blocked
    if (!user.isActive) {
      logger.warn({ email, userId: user.id }, 'Login failed: account blocked')
      return NextResponse.json(
        { success: false, error: 'Akun Anda telah diblokir. Hubungi admin.' },
        { status: 403 }
      )
    }

    // Check if account is temporarily locked due to too many failed attempts
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS && user.lockedUntil && new Date() < user.lockedUntil) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      logger.warn({ email, userId: user.id, remainingMinutes }, 'Login failed: account temporarily locked')
      return NextResponse.json(
        { success: false, error: `Akun sementara dikunci karena terlalu banyak percobaan gagal. Coba lagi dalam ${remainingMinutes} menit.` },
        { status: 423 }
      )
    }

    // If lockout period has expired, reset the counter
    if (user.lockedUntil && new Date() >= user.lockedUntil) {
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      })
    }

    // Check if user has a password set (OAuth-only users won't have one)
    if (!user.password) {
      logger.info({ email, userId: user.id }, 'Login failed: no password (OAuth-only user)')
      return NextResponse.json(
        { success: false, error: 'Akun ini terdaftar melalui Google. Gunakan login Google atau atur password terlebih dahulu.' },
        { status: 401 }
      )
    }

    // Verify password with bcrypt
    let isPasswordValid = false
    const isBcryptHash = isValidBcryptHash(user.password)
    const hashPrefix = user.password.substring(0, 4)

    try {
      isPasswordValid = await bcrypt.compare(password, user.password) as unknown as boolean
    } catch (compareError) {
      logger.warn({ email, userId: user.id, hashPrefix, err: compareError }, 'Login: bcrypt.compare threw an error — hash may be corrupted')
      isPasswordValid = false
    }

    // SECURITY: Plaintext password fallback has been REMOVED.
    // If a password hash is not valid bcrypt, the login is rejected.
    // Users with corrupted/legacy passwords must use the "Forgot Password" flow to reset.
    if (!isPasswordValid && !isBcryptHash) {
      logger.warn(
        { email, userId: user.id, hashPrefix },
        'Login failed: stored password is not valid bcrypt format — user must reset password'
      )
    }

    if (!isPasswordValid) {
      logger.info(
        { email, userId: user.id, hashPrefix, isBcryptHash },
        'Login failed: incorrect password'
      )

      // Increment failed login attempts for account lockout
      const newFailedAttempts = (user.failedLoginAttempts || 0) + 1
      const lockUntil = newFailedAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
        : null

      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          ...(lockUntil ? { lockedUntil: lockUntil } : {}),
        },
      })

      if (lockUntil) {
        logger.warn({ email, userId: user.id }, `Account locked for ${LOCKOUT_DURATION_MINUTES} minutes due to ${newFailedAttempts} failed attempts`)

        // SECURITY: Send email notification to the user about the account lock
        // This helps legitimate users detect unauthorized login attempts on their account
        try {
          const lockTemplate = accountLockedTemplate(user.name, LOCKOUT_DURATION_MINUTES)
          await sendEmail({
            to: user.email,
            subject: lockTemplate.subject,
            html: lockTemplate.html,
          })
          logger.info({ component: 'auth', userId: user.id }, 'Account lockout notification email sent')
        } catch (emailErr) {
          logger.warn({ component: 'auth', err: emailErr }, 'Failed to send account lockout notification email')
        }
      }

      return NextResponse.json(
        { success: false, error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Check if email is verified
    if (!user.isVerified) {
      logger.info({ email, userId: user.id }, 'Login failed: email not verified')
      return NextResponse.json(
        {
          success: false,
          error: 'Email belum diverifikasi. Silakan cek email Anda untuk link verifikasi.',
          requiresVerification: true,
          email: user.email,
        },
        { status: 403 }
      )
    }

    // Check if user has 2FA enabled
    if (user.twoFactorEnabled) {
      if (!user.phone) {
        // SECURITY: Don't bypass 2FA silently — reject the login instead.
        // The user must contact support or use password reset to regain access.
        logger.warn({ email, userId: user.id }, 'Login rejected: 2FA enabled but no phone number on file')
        return NextResponse.json(
          {
            success: false,
            error: 'Akun Anda mengaktifkan 2FA tetapi nomor HP tidak tersedia. Silakan hubungi support atau reset password untuk menonaktifkan 2FA.',
          },
          { status: 403 }
        )
      }

      // Generate OTP for 2FA verification
      const otpCode = crypto.randomInt(0, Math.pow(10, OTP_LENGTH)).toString().padStart(OTP_LENGTH, '0')
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

      await db.user.update({
        where: { id: user.id },
        data: { otpCode: hashOtp(otpCode), otpExpiry },
      })

      // Send OTP via SMS gateway
      try {
        const { sendOTP } = await import('@/lib/sms-gateway')
        const smsResult = await sendOTP(user.phone, otpCode, OTP_EXPIRY_MINUTES)
        if (smsResult.success) {
          logger.info({ component: 'auth', userId: user.id, provider: smsResult.provider }, `[2FA Login] OTP sent to ${user.phone} via ${smsResult.provider}`)
        } else {
          logger.warn({ component: 'auth', userId: user.id, provider: smsResult.provider, error: smsResult.error }, `[2FA Login] Failed to send OTP to ${user.phone} via ${smsResult.provider}: ${smsResult.error}`)
        }
      } catch (smsError) {
        logger.error({ component: 'auth', userId: user.id, err: smsError }, '[2FA Login] SMS gateway exception')
      }

      const isDev = process.env.NODE_ENV === 'development'

      // Return requires2FA flag — client should redirect to OTP screen
      return NextResponse.json({
        success: true,
        requires2FA: true,
        phone: maskPhone(user.phone),
        userId: user.id,
        message: `Verifikasi 2FA diperlukan. Kode OTP dikirim ke ${maskPhone(user.phone)}`,
      })
    }

    // Normal login (no 2FA) — generate auth token
    const token = generateAuthToken(user.id, user.tokenVersion ?? 0)

    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      })
    }

    // Reset rate limit counter on successful login — a legitimate user who finally
    // gets the password right should not be penalized for prior failed attempts.
    try {
      await authLimiter.reset(`login:${clientIp}`)
    } catch (resetErr) {
      logger.warn({ err: resetErr }, 'Failed to reset login rate limit counter')
    }

    // Return user data (without password and sensitive banking details)
    const { password: _, ...userWithoutPassword } = user

    // SECURITY: Redact sensitive banking details from seller object in login response.
    // Banking info should only be accessible via dedicated seller profile endpoints.
    if (userWithoutPassword.seller) {
      const { bankAccount, bankHolder, bankName, ...safeSeller } = userWithoutPassword.seller
      userWithoutPassword.seller = safeSeller
    }

    logger.info({ email, userId: user.id }, 'Login successful')

    const response = NextResponse.json({
      success: true,
      user: userWithoutPassword,
      token,
      // SECURITY NOTE: isSuperAdmin is only in the user's own auth response — not in any user-listing API
      isSuperAdmin: isSuperAdmin(user.role, user.email),
      message: 'Login berhasil',
    })
    // Set session cookies (httpOnly + flag) — persistent if Remember Me, session otherwise
    setSessionCookies(response, token, rememberMe)
    return response
  } catch (error: any) {
    logger.error({ err: error, code: error?.code }, 'Login error')
    
    // Provide more specific error messages for common issues
    let errorMessage: string
    let statusCode = 500
    
    if (error?.code === 'P1001') {
      errorMessage = 'Database tidak dapat diakses. Pastikan SUPABASE_DATABASE_URL sudah dikonfigurasi di Vercel Dashboard → Settings → Environment Variables.'
      statusCode = 503
    } else if (error?.code === 'P1002') {
      errorMessage = 'Database connection timeout. Coba lagi dalam beberapa detik.'
      statusCode = 503
    } else if (error?.code === 'ENOTFOUND') {
      errorMessage = 'Database host tidak ditemukan. Pastikan SUPABASE_DATABASE_URL benar.'
      statusCode = 503
    } else {
      errorMessage = 'Terjadi kesalahan server. Coba lagi nanti.'
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage, 
        // Always include error code for diagnostics (safe to expose)
        errorCode: error?.code || 'UNKNOWN',
      },
      { status: statusCode }
    )
  }
}
