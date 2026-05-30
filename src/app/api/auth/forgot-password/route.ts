import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail, passwordResetTemplate } from '@/lib/email'
import { authLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import crypto from 'crypto'
import { hashToken } from '@/lib/token-hash'

// POST /api/auth/forgot-password
// Sends a password reset email to the user
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await authLimiter.check(`forgot:${ip}`)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan. Coba lagi dalam beberapa menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email wajib diisi' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    })

    // Always return success to prevent email enumeration attacks
    // But only send email if user actually exists
    if (!user) {
      logger.info({ component: 'auth', email: normalizedEmail }, 'Password reset requested for non-existent email')
      return NextResponse.json({
        success: true,
        message: 'Jika email terdaftar, link reset password telah dikirim.',
      })
    }

    // Don't send reset for OAuth-only users (no password)
    if (!user.password) {
      logger.info({ component: 'auth', userId: user.id }, 'Password reset requested for OAuth-only user')
      return NextResponse.json({
        success: true,
        message: 'Jika email terdaftar, link reset password telah dikirim.',
      })
    }

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Store the token in the database
    await db.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashToken(resetToken),
        resetPasswordExpiry: resetExpiry,
      },
    })

    // Build the reset URL
    // SECURITY: Use hash fragment (#) instead of query parameter (?)
    // Hash fragments are NOT sent to the server in HTTP requests, preventing
    // the token from appearing in server logs, referrer headers, or browser history.
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const resetUrl = `${baseUrl}/#reset-token=${resetToken}`

    // Send the reset email
    try {
      const template = passwordResetTemplate(user.name, resetUrl)
      const emailResult = await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
      })

      if (emailResult.devUrl) {
        logger.info({ component: 'auth', devUrl: emailResult.devUrl }, 'Password reset email sent (dev mode)')
      }
    } catch (emailError) {
      logger.warn({ component: 'auth', err: emailError }, 'Failed to send password reset email')
      // Don't reveal email sending failure to prevent enumeration
    }

    logger.info({ component: 'auth', userId: user.id }, 'Password reset token generated')

    return NextResponse.json({
      success: true,
      message: 'Jika email terdaftar, link reset password telah dikirim.',
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Forgot password error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
