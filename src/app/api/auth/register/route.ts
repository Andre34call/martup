import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateAuthToken } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendEmail, emailVerificationTemplate } from '@/lib/email'
import { logger } from '@/lib/logger'
import { validateBody, registerSchema } from '@/lib/validations'
import { setSessionCookies } from '@/lib/session-cookie'
import { hashToken } from '@/lib/token-hash'
import { sanitizeInput } from '@/lib/sanitize'

// Rate limiter: 3 registrations per minute per IP
const registerLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3, keyPrefix: 'rl:auth:register:' })

// POST /api/auth/register - Register a new user with email and password
// Now requires email verification before login
export async function POST(request: NextRequest) {
  try {
    // Rate limit check - stricter for register (3 per minute per IP)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await registerLimiter.check(clientIp)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak percobaan registrasi. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validation = validateBody(registerSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { name: rawName, email, phone, password } = validation.data
    const name = sanitizeInput(rawName)

    // SECURITY: Check if phone number is already registered (unique constraint)
    if (phone) {
      const existingPhoneUser = await db.user.findUnique({ where: { phone } })
      if (existingPhoneUser) {
        return NextResponse.json(
          { success: false, error: 'Nomor HP sudah terdaftar. Gunakan nomor lain atau login.' },
          { status: 409 }
        )
      }
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      // If user exists but is NOT verified, allow re-registration
      if (!existingUser.isVerified) {
        // Check if mock email provider — auto-verify instead of sending email
        const emailProvider = (process.env.EMAIL_PROVIDER as string) || 'mock'
        const isMockEmail = emailProvider === 'mock' || !process.env.RESEND_API_KEY

        // Update password
        const saltRounds = 12
        const hashedPassword = await bcrypt.hash(password, saltRounds)

        if (isMockEmail) {
          // Auto-verify: user can login immediately
          await db.user.update({
            where: { id: existingUser.id },
            data: {
              name,
              password: hashedPassword,
              phone: phone || existingUser.phone,
              isVerified: true,
              emailVerificationToken: null,
              emailVerificationExpiry: null,
            },
          })

          logger.info({ component: 'auth', email }, 'Unverified user auto-verified on re-registration')

          // Fetch full user data for response
          const fullUser = await db.user.findUnique({
            where: { id: existingUser.id },
            select: { id: true, email: true, name: true, phone: true, avatar: true, role: true, isVerified: true, isActive: true, loyaltyPoints: true, coins: true, referralCode: true, dailyCheckIn: true, divisionId: true, tokenVersion: true, createdAt: true, updatedAt: true, seller: true, wallet: true },
          })
          // fullUser doesn't include password in select, so no need to destructure it out
          const userWithoutPassword = fullUser!

          // Generate auth token with tokenVersion
          const token = generateAuthToken(existingUser.id, fullUser?.tokenVersion ?? 0)

          const resp = NextResponse.json({
            success: true,
            user: userWithoutPassword,
            token,
            message: 'Akun Anda telah aktif! Silakan login.',
          })
          setSessionCookies(resp, token)
          return resp
        }

        // Real email: generate verification token and send email
        const verificationToken = crypto.randomBytes(32).toString('hex')
        const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

        await db.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            password: hashedPassword,
            phone: phone || existingUser.phone,
            emailVerificationToken: hashToken(verificationToken),
            emailVerificationExpiry: verificationExpiry,
          },
        })

        const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
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
          ...(process.env.NODE_ENV === 'development' ? { devVerifyUrl: emailResult.devUrl } : {}),
        })
      }

      // SECURITY: Don't reveal whether email is registered — return same message as successful registration
      logger.info({ component: 'auth', email }, 'Registration attempt with existing verified email — returning generic message')
      return NextResponse.json({
        success: true,
        requiresVerification: false,
        message: 'Jika email tersedia, registrasi akan diproses. Cek email Anda untuk verifikasi.',
      })
    }

    // Hash password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Check if email provider is mock (no real email sending)
    // When mock, auto-verify users so they can login immediately
    const emailProvider = (process.env.EMAIL_PROVIDER as string) || 'mock'
    const isMockEmail = emailProvider === 'mock' || !process.env.RESEND_API_KEY
    const shouldAutoVerify = isMockEmail

    // Create user - ALWAYS as buyer (NEVER admin)
    // If email provider is mock, auto-verify so user can login immediately
    const user = await db.user.create({
      data: {
        email,
        name,
        phone: phone || null,
        password: hashedPassword,
        role: 'buyer',
        isVerified: shouldAutoVerify, // Auto-verify when no real email provider
        emailVerificationToken: shouldAutoVerify ? null : hashToken(verificationToken),
        emailVerificationExpiry: shouldAutoVerify ? null : verificationExpiry,
        wallet: {
          create: {
            balance: 0,
            holdBalance: 0,
          },
        },
      },
    })

    // Create welcome notification
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Selamat Datang di MartUp! 🎉',
        content: shouldAutoVerify
          ? 'Terima kasih telah bergabung. Mulai belanja atau jual produk sekarang!'
          : 'Terima kasih telah bergabung. Verifikasi email Anda untuk mulai belanja!',
        type: 'system',
        isRead: false,
      },
    })

    if (shouldAutoVerify) {
      // Auto-verified: no email sent, user can login immediately
      logger.info({ component: 'auth', email, provider: emailProvider }, 'User auto-verified (mock email provider)')

      // Fetch full user data for response
      const fullUser = await db.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true, phone: true, avatar: true, role: true, isVerified: true, isActive: true, loyaltyPoints: true, coins: true, referralCode: true, dailyCheckIn: true, divisionId: true, tokenVersion: true, createdAt: true, updatedAt: true, seller: true, wallet: true },
      })

      // fullUser doesn't include password in select, so no need to destructure it out
      const userWithoutPassword = fullUser!

      // Generate auth token so user is automatically logged in
      const token = generateAuthToken(user.id, fullUser?.tokenVersion ?? 0)

      const resp = NextResponse.json({
        success: true,
        user: userWithoutPassword,
        token,
        isSuperAdmin: false, // New registrations are never Super Admin
        message: 'Registrasi berhasil! Akun Anda telah aktif.',
      })
      setSessionCookies(resp, token)
      return resp
    }

    // Real email provider: send verification email
    const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`
    const template = emailVerificationTemplate(name, verificationUrl)
    const emailResult = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
    })

    logger.info({ component: 'auth', email, emailProvider: emailResult.provider, emailSuccess: emailResult.success, emailError: emailResult.error }, 'Verification email sent')

    // If email failed to send, inform the user and provide a resend option
    if (!emailResult.success) {
      logger.error({ component: 'auth', email, error: emailResult.error }, 'Failed to send verification email')
      return NextResponse.json({
        success: true,
        requiresVerification: true,
        email,
        emailSent: false,
        message: 'Registrasi berhasil, tetapi email verifikasi gagal dikirim. Gunakan fitur "Kirim Ulang" di halaman login.',
        ...(process.env.NODE_ENV === 'development' ? { devVerifyUrl: emailResult.devUrl } : {}),
      })
    }

    // Return success WITHOUT token — user must verify email first
    return NextResponse.json({
      success: true,
      requiresVerification: true,
      email,
      emailSent: true,
      message: 'Registrasi berhasil! Silakan cek email Anda untuk verifikasi.',
      ...(process.env.NODE_ENV === 'development' ? { devVerifyUrl: emailResult.devUrl } : {}),
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Register error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
