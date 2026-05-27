import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, generateAuthToken } from '@/lib/auth-middleware'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

import { logger } from '@/lib/logger'

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
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email dan password wajib diisi' },
        { status: 400 }
      )
    }

    // SECURITY: Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Format email tidak valid' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
      include: {
        seller: true,
        wallet: true,
      },
    })

    // User not found
    if (!user) {
      // Don't reveal whether email exists or not for security
      return NextResponse.json(
        { success: false, error: 'Email atau password salah' },
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

    // Check if user has a password set (OAuth-only users won't have one)
    if (!user.password) {
      return NextResponse.json(
        { success: false, error: 'Akun ini terdaftar melalui Google. Gunakan login Google atau atur password terlebih dahulu.' },
        { status: 401 }
      )
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Check if email is verified
    if (!user.isVerified) {
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
        ...(process.env.NODE_ENV === 'development' ? { debug: error?.message, code: error?.code } : {}) 
      },
      { status: statusCode }
    )
  }
}
