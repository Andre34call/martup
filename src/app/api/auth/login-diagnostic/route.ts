import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { checkRateLimit } from '@/lib/auth-middleware'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

// Helper: check if a string looks like a valid bcrypt hash
function isValidBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash)
}

// POST /api/auth/login-diagnostic - Diagnostic endpoint for login issues
// Protected by TOKEN_SECRET (Authorization: Bearer <secret> or x-login-debug: <secret>)
// Rate limited: 3 per minute per IP
export async function POST(request: NextRequest) {
  try {
    // ==================== AUTHORIZATION CHECK ====================
    const tokenSecret = env.TOKEN_SECRET
    const authHeader = request.headers.get('authorization')
    const debugHeader = request.headers.get('x-login-debug')

    const bearerToken = authHeader?.replace(/^bearer\s+/i, '')
    const isAuthorized = (bearerToken && bearerToken === tokenSecret) || debugHeader === tokenSecret

    if (!isAuthorized) {
      logger.warn({ component: 'security', path: '/api/auth/login-diagnostic' }, 'Unauthorized diagnostic attempt')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // ==================== RATE LIMIT ====================
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`login-diag:${clientIp}`, 3)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Max 3 requests per minute.' },
        { status: 429 }
      )
    }

    // ==================== PARSE & VALIDATE BODY ====================
    const body = await request.json()
    const { email, password } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // ==================== LOOKUP USER ====================
    let user = await db.user.findUnique({
      where: { email: normalizedEmail },
    })

    // Fallback: case-insensitive lookup
    if (!user) {
      user = await db.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      })
    }

    // ==================== BUILD DIAGNOSTIC RESULT ====================
    const diagnostic = {
      userFound: !!user,
      hasPassword: false as boolean,
      passwordHashValid: false as boolean,
      passwordHashPrefix: null as string | null,
      passwordMatch: false as boolean,
      isVerified: false as boolean,
      isActive: false as boolean,
      fixApplied: false as boolean,
    }

    if (!user) {
      logger.info({ component: 'auth', email: normalizedEmail }, 'Login diagnostic: user not found')
      return NextResponse.json({ success: true, diagnostic })
    }

    diagnostic.hasPassword = !!user.password
    diagnostic.isVerified = user.isVerified
    diagnostic.isActive = user.isActive

    if (!user.password) {
      logger.info({ component: 'auth', email: normalizedEmail, userId: user.id }, 'Login diagnostic: no password field')
      return NextResponse.json({ success: true, diagnostic })
    }

    // Check if the stored hash looks like a valid bcrypt hash
    diagnostic.passwordHashValid = isValidBcryptHash(user.password)
    diagnostic.passwordHashPrefix = user.password.substring(0, 4)

    // Try bcrypt.compare
    try {
      diagnostic.passwordMatch = await bcrypt.compare(password, user.password)
    } catch (compareError) {
      logger.warn({ component: 'auth', err: compareError, userId: user.id }, 'Login diagnostic: bcrypt.compare threw an error')
      diagnostic.passwordMatch = false
    }

    // ==================== AUTO-FIX: PLAIN TEXT PASSWORD ====================
    if (!diagnostic.passwordHashValid && !diagnostic.passwordMatch) {
      // The stored value is NOT a valid bcrypt hash, and bcrypt.compare failed.
      // Check if the stored value is the raw/plain-text password.
      if (user.password === password) {
        logger.info({ component: 'auth', userId: user.id, email: normalizedEmail }, 'Login diagnostic: detected plain-text password, applying auto-fix')

        const saltRounds = 12
        const hashedPassword = await bcrypt.hash(password, saltRounds)

        await db.user.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        })

        diagnostic.fixApplied = true
        diagnostic.passwordMatch = true
        diagnostic.passwordHashValid = true
        diagnostic.passwordHashPrefix = hashedPassword.substring(0, 4)

        logger.info({ component: 'auth', userId: user.id }, 'Login diagnostic: plain-text password re-hashed successfully')
      }
    }

    logger.info(
      { component: 'auth', email: normalizedEmail, userId: user.id, diagnostic },
      'Login diagnostic completed'
    )

    return NextResponse.json({ success: true, diagnostic })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Login diagnostic error')
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
