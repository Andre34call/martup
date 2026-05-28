import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, generateAuthToken } from '@/lib/auth-middleware'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

import { logger } from '@/lib/logger'
import { validateBody, loginSchema } from '@/lib/validations'

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

// POST /api/auth/login - Login with email and password
export async function POST(request: NextRequest) {
  try {
    // Rate limit check - stricter for login (5 per minute per IP)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`login:${clientIp}`)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan login. Coba lagi dalam 1 menit.' },
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
      const response: Record<string, unknown> = {
        success: false,
        error: 'Email atau password salah',
        // TEMP: Always include debugHint for login debugging (remove after fix)
        debugHint: 'user_not_found',
      }
      return NextResponse.json(response, { status: 401 })
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

    // Check if user has a password set (OAuth-only users won't have one)
    if (!user.password) {
      logger.info({ email, userId: user.id }, 'Login failed: no password (OAuth-only user)')
      return NextResponse.json(
        { success: false, error: 'Akun ini terdaftar melalui Google. Gunakan login Google atau atur password terlebih dahulu.' },
        { status: 401 }
      )
    }

    // Verify password
    let isPasswordValid = false
    const isBcryptHash = isValidBcryptHash(user.password)
    const hashPrefix = user.password.substring(0, 4)

    try {
      isPasswordValid = await bcrypt.compare(password, user.password)
    } catch (compareError) {
      logger.warn({ email, userId: user.id, hashPrefix, err: compareError }, 'Login: bcrypt.compare threw an error — hash may be corrupted')
      isPasswordValid = false
    }

    // FALLBACK: If bcrypt.compare fails AND the stored hash doesn't look like a valid bcrypt hash,
    // try a plain-text comparison (for legacy accounts where password was stored unhashed).
    // If it matches, re-hash and update the database so future logins use bcrypt.
    let plainTextFixed = false
    if (!isPasswordValid && !isBcryptHash) {
      if (user.password === password) {
        logger.info({ email, userId: user.id, hashPrefix }, 'Login: detected plain-text password, re-hashing')
        try {
          const saltRounds = 12
          const hashedPassword = await bcrypt.hash(password, saltRounds)
          await db.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
          })
          isPasswordValid = true
          plainTextFixed = true
          logger.info({ email, userId: user.id }, 'Login: plain-text password re-hashed successfully')
        } catch (fixError) {
          logger.error({ email, userId: user.id, err: fixError }, 'Login: failed to re-hash plain-text password')
        }
      } else {
        logger.info(
          { email, userId: user.id, hashPrefix, isBcryptHash },
          'Login failed: incorrect password (stored hash is not valid bcrypt format)'
        )
      }
    }

    if (!isPasswordValid) {
      // Log detailed failure info (hash prefix is safe to log for diagnostics)
      logger.info(
        { email, userId: user.id, hashPrefix, isBcryptHash },
        'Login failed: incorrect password'
      )
      const response: Record<string, unknown> = {
        success: false,
        error: 'Email atau password salah',
        // TEMP: Always include debugHint for login debugging (remove after fix)
        debugHint: isBcryptHash
          ? 'bcrypt_compare_failed'
          : 'stored_password_not_bcrypt_hash',
        hashPrefix,
      }
      return NextResponse.json(response, { status: 401 })
    }

    // Check if email is verified
    if (!user.isVerified) {
      logger.info({ email, userId: user.id }, 'Login failed: email not verified')
      const response: Record<string, unknown> = {
        success: false,
        error: 'Email belum diverifikasi. Silakan cek email Anda untuk link verifikasi.',
        requiresVerification: true,
        email: user.email,
      }
      // In development, include debug info
      if (process.env.NODE_ENV === 'development') {
        response.debugUserFound = true
        response.debugPasswordMatch = true
        response.debugIsVerified = false
      }
      return NextResponse.json(response, { status: 403 })
    }

    // Check if user has 2FA enabled
    if (user.twoFactorEnabled) {
      if (!user.phone) {
        // Edge case: 2FA enabled but no phone — allow login anyway and suggest disabling 2FA
        const token = generateAuthToken(user.id)
        const { password: _, ...userWithoutPassword } = user
        return NextResponse.json({
          success: true,
          user: userWithoutPassword,
          token,
          message: 'Login berhasil (2FA tidak dapat diverifikasi karena nomor HP tidak tersedia)',
        })
      }

      // Generate OTP for 2FA verification
      const otpCode = crypto.randomInt(0, Math.pow(10, OTP_LENGTH)).toString().padStart(OTP_LENGTH, '0')
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

      await db.user.update({
        where: { id: user.id },
        data: { otpCode, otpExpiry },
      })

      // In production: Send OTP via SMS gateway
      logger.info(`[2FA Login] OTP sent to ${user.phone} (expires in ${OTP_EXPIRY_MINUTES} min)`)

      const isDev = process.env.NODE_ENV === 'development'

      // Return requires2FA flag — client should redirect to OTP screen
      return NextResponse.json({
        success: true,
        requires2FA: true,
        phone: maskPhone(user.phone),
        userId: user.id,
        message: `Verifikasi 2FA diperlukan. Kode OTP dikirim ke ${maskPhone(user.phone)}`,
        ...(isDev ? { devOtp: otpCode } : {}),
      })
    }

    // Normal login (no 2FA) — generate auth token
    const token = generateAuthToken(user.id)

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user

    logger.info({ email, userId: user.id }, 'Login successful')
    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      token,
      message: 'Login berhasil',
    })
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
