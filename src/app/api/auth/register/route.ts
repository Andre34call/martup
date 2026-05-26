import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit } from '@/lib/auth-middleware'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendEmail, emailVerificationTemplate } from '@/lib/email'
import { logger } from '@/lib/logger'

// POST /api/auth/register - Register a new user with email and password
// Now requires email verification before login
export async function POST(request: NextRequest) {
  try {
    // Rate limit check - stricter for register (3 per minute per IP)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`register:${clientIp}`, 3)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan registrasi. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email, phone, password } = body

    // Validate required fields
    if (!name || name.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Nama minimal 3 karakter' },
        { status: 400 }
      )
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Format email tidak valid' },
        { status: 400 }
      )
    }

    if (!password || password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { success: false, error: 'Password minimal 8 karakter, harus mengandung huruf dan angka' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      // If user exists but is NOT verified, allow re-registration (resend verification)
      if (!existingUser.isVerified) {
        // Generate new verification token
        const verificationToken = crypto.randomBytes(32).toString('hex')
        const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

        // Update password and verification token
        const saltRounds = 12
        const hashedPassword = await bcrypt.hash(password, saltRounds)

        await db.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            password: hashedPassword,
            phone: phone || existingUser.phone,
            emailVerificationToken: verificationToken,
            emailVerificationExpiry: verificationExpiry,
          },
        })

        // Send verification email
        const baseUrl = process.env.NEXTAUTH_URL || 'https://martup-seven.vercel.app'
        const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`
        const template = emailVerificationTemplate(name, verificationUrl)
        const emailResult = await sendEmail({
          to: email,
          subject: template.subject,
          html: template.html,
        })

        logger.info({ component: 'auth', email, emailResult }, 'Verification email resent for unverified user')

        return NextResponse.json({
          success: true,
          requiresVerification: true,
          email,
          message: 'Email verifikasi telah dikirim ulang. Silakan cek email Anda.',
          devVerifyUrl: emailResult.devUrl, // For mock provider
        })
      }

      return NextResponse.json(
        { success: false, error: 'Email sudah terdaftar. Silakan login.' },
        { status: 409 }
      )
    }

    // Hash password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create user - ALWAYS as buyer (NEVER admin), with verification token
    const user = await db.user.create({
      data: {
        email,
        name,
        phone: phone || null,
        password: hashedPassword,
        role: 'buyer',
        isVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
        wallet: {
          create: {
            balance: 0,
            holdBalance: 0,
          },
        },
      },
    })

    // Send verification email
    const baseUrl = process.env.NEXTAUTH_URL || 'https://martup-seven.vercel.app'
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`
    const template = emailVerificationTemplate(name, verificationUrl)
    const emailResult = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
    })

    logger.info({ component: 'auth', email, emailResult }, 'Verification email sent')

    // Create welcome notification (they'll see it after verifying)
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Selamat Datang di MartUp! 🎉',
        content: 'Terima kasih telah bergabung. Verifikasi email Anda untuk mulai belanja!',
        type: 'system',
        isRead: false,
      },
    })

    // Return success WITHOUT token — user must verify email first
    return NextResponse.json({
      success: true,
      requiresVerification: true,
      email,
      message: 'Registrasi berhasil! Silakan cek email Anda untuk verifikasi.',
      devVerifyUrl: emailResult.devUrl, // For mock provider in development
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Register error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
