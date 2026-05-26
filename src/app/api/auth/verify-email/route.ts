import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail, emailVerifiedTemplate } from '@/lib/email'
import { logger } from '@/lib/logger'

// GET /api/auth/verify-email?token=xxx
// Verifies a user's email using the token sent to their email
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(
        new URL('/?verification=missing-token', request.url)
      )
    }

    // Handle dev/mock tokens
    if (token.startsWith('dev-verify-')) {
      try {
        const payload = JSON.parse(Buffer.from(token.replace('dev-verify-', ''), 'base64').toString())
        // In dev mode, find user by email from the mock token payload
        const user = await db.user.findUnique({ where: { email: payload.to } })
        if (user && !user.isVerified) {
          await db.user.update({
            where: { id: user.id },
            data: {
              isVerified: true,
              emailVerificationToken: null,
              emailVerificationExpiry: null,
            },
          })
          logger.info({ component: 'auth', userId: user.id }, 'Email verified (dev mode)')
        }
      } catch {
        // Ignore malformed dev tokens
      }
      return NextResponse.redirect(
        new URL('/?verification=success', request.url)
      )
    }

    // Find user by verification token
    const user = await db.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: { gt: new Date() },
      },
    })

    if (!user) {
      // Token expired or invalid
      return NextResponse.redirect(
        new URL('/?verification=expired', request.url)
      )
    }

    // Verify the user
    await db.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    })

    // Send confirmation email
    try {
      const template = emailVerifiedTemplate(user.name)
      await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
      })
    } catch (emailError) {
      // Don't fail verification if confirmation email fails
      logger.warn({ component: 'auth', err: emailError }, 'Failed to send confirmation email')
    }

    logger.info({ component: 'auth', userId: user.id, email: user.email }, 'Email verified successfully')

    // Redirect to login page with success message
    return NextResponse.redirect(
      new URL('/?verification=success', request.url)
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'Email verification error')
    return NextResponse.redirect(
      new URL('/?verification=error', request.url)
    )
  }
}
