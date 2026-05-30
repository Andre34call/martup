import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit } from '@/lib/auth-middleware'
import { authLimiter } from '@/lib/rate-limit'
import crypto from 'crypto'
import { sendEmail, emailVerificationTemplate } from '@/lib/email'
import { logger } from '@/lib/logger'
import { hashToken } from '@/lib/token-hash'
import { validateBody, resendVerificationSchema } from '@/lib/validations'

// POST /api/auth/resend-verification
// Resends email verification to an unverified user
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 per minute per IP
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`resend-verify:${clientIp}`, 3)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }
    // Also use distributed rate limiter (persists across serverless cold starts)
    const distLimit = await authLimiter.check(`resend-verify:${clientIp}`)
    if (!distLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam beberapa menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validation = validateBody(resendVerificationSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { email } = validation.data

    // Find user by email
    const user = await db.user.findUnique({ where: { email } })

    if (!user) {
      // Don't reveal if email exists or not — same success message
      return NextResponse.json({
        success: true,
        message: 'Jika email terdaftar dan belum terverifikasi, link verifikasi telah dikirim.',
      })
    }

    // If already verified, tell them to login
    if (user.isVerified) {
      return NextResponse.json({
        success: true,
        message: 'Email sudah terverifikasi. Silakan login.',
        alreadyVerified: true,
      })
    }

    // Check if token was recently sent (prevent spam — 1 minute cooldown)
    // emailVerificationExpiry = tokenCreatedAt + 24h, so tokenCreatedAt = expiry - 24h
    if (user.emailVerificationExpiry) {
      const tokenCreatedAt = user.emailVerificationExpiry.getTime() - 24 * 60 * 60 * 1000
      const timeSinceLastSent = Date.now() - tokenCreatedAt
      if (timeSinceLastSent < 60 * 1000) {
        return NextResponse.json(
          { success: false, error: 'Tunggu 1 menit sebelum mengirim ulang.' },
          { status: 429 }
        )
      }
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashToken(verificationToken),
        emailVerificationExpiry: verificationExpiry,
      },
    })

    // Send verification email
    const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`
    const template = emailVerificationTemplate(user.name, verificationUrl)
    const emailResult = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
    })

    logger.info({ component: 'auth', email, emailResult }, 'Verification email resent')

    return NextResponse.json({
      success: true,
      message: 'Link verifikasi telah dikirim ke email Anda.',
      ...(process.env.NODE_ENV === 'development' ? { devVerifyUrl: emailResult.devUrl } : {}),
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Resend verification error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
