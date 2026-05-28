import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/login-diagnostic - Diagnose login failures (admin-only).
 *
 * Requires x-admin-secret header matching TOKEN_SECRET.
 * Returns detailed diagnostic info about why a login is failing.
 * Also auto-fixes plain-text passwords if detected.
 */
export async function POST(request: NextRequest) {
  // Admin-only: verify secret
  const adminSecret = request.headers.get('x-admin-secret')
  if (!adminSecret || adminSecret !== env.TOKEN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Find user
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: { seller: true, wallet: true },
    })

    if (!user) {
      // Try case-insensitive
      const userByInsensitive = await db.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      })

      return NextResponse.json({
        found: false,
        emailSearched: normalizedEmail,
        caseInsensitiveMatch: userByInsensitive
          ? { id: userByInsensitive.id, email: userByInsensitive.email, isVerified: userByInsensitive.isVerified }
          : null,
        diagnosis: 'User not found with this email',
      })
    }

    // User found — return diagnostic info
    const passwordInfo = {
      hasPassword: !!user.password,
      passwordLength: user.password?.length || 0,
      hashPrefix: user.password?.substring(0, 7) || '',
      looksLikeBcrypt: /^\$2[aby]\$\d{2}\$/.test(user.password || ''),
    }

    // Try bcrypt compare with the provided password if given
    let passwordCheck = null
    if (body.password) {
      const isBcryptHash = passwordInfo.looksLikeBcrypt
      let bcryptResult = false
      let plainTextResult = false

      try {
        bcryptResult = await bcrypt.compare(body.password, user.password)
      } catch {
        bcryptResult = false
      }

      if (!bcryptResult && !isBcryptHash) {
        plainTextResult = user.password === body.password
        if (plainTextResult) {
          // Auto-fix: re-hash the plain-text password
          const hashedPassword = await bcrypt.hash(body.password, 12)
          await db.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
          })
          logger.info({ email: normalizedEmail, userId: user.id }, 'Auto-fixed plain-text password via diagnostic endpoint')
        }
      }

      passwordCheck = {
        bcryptMatch: bcryptResult,
        plainTextMatch: plainTextResult,
        autoFixed: plainTextResult && !isBcryptHash,
      }
    }

    return NextResponse.json({
      found: true,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      phone: user.phone,
      passwordInfo,
      passwordCheck,
      diagnosis: !user.isActive
        ? 'Account is blocked'
        : !user.isVerified
        ? 'Email not verified'
        : passwordCheck?.bcryptMatch
        ? 'Login should work'
        : passwordCheck?.plainTextMatch
        ? 'Plain-text password auto-fixed, try again'
        : !passwordInfo.hasPassword
        ? 'No password set (OAuth-only account)'
        : 'Password mismatch — check if password is correct or if hash is corrupted',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
