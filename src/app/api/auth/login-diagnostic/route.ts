import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/login-diagnostic - Diagnose login failures (admin-only).
 *
 * SECURITY:
 * - Requires a DEDICATED ADMIN_DIAGNOSTIC_SECRET env var (NOT TOKEN_SECRET)
 * - DISABLED in production unless ADMIN_DIAGNOSTIC_SECRET is explicitly set
 * - Does NOT expose password hashes, hash prefixes, or hash format details
 * - Does NOT allow password verification (removed — was an attack vector)
 * - Does NOT auto-fix passwords
 * - Rate limited: max 5 requests per minute per IP
 * - Does NOT expose userId or other internal identifiers
 *
 * This endpoint only provides account status diagnostics:
 * - Does the account exist?
 * - Is it active/blocked/locked?
 * - Is email verified?
 * - Is 2FA enabled?
 * - Is it an OAuth-only account (no password)?
 */

// Simple in-memory rate limiter for this endpoint
const diagnosticRateLimit = new Map<string, { count: number; expiresAt: number }>()
const DIAGNOSTIC_RATE_LIMIT = 5 // max 5 requests per minute

export async function POST(request: NextRequest) {
  // SECURITY: Rate limit this endpoint aggressively
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  const now = Date.now()
  const rateEntry = diagnosticRateLimit.get(clientIp)
  if (!rateEntry || now > rateEntry.expiresAt) {
    diagnosticRateLimit.set(clientIp, { count: 1, expiresAt: now + 60_000 })
  } else {
    rateEntry.count++
    if (rateEntry.count > DIAGNOSTIC_RATE_LIMIT) {
      return NextResponse.json(
        { error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }
  }

  // Lazy cleanup of expired rate limit entries
  for (const [key, entry] of diagnosticRateLimit.entries()) {
    if (now > entry.expiresAt) diagnosticRateLimit.delete(key)
  }

  // SECURITY: Require ADMIN_DIAGNOSTIC_SECRET — endpoint is disabled without it
  const diagnosticSecret = process.env.ADMIN_DIAGNOSTIC_SECRET
  if (!diagnosticSecret) {
    return NextResponse.json(
      { error: 'Endpoint dinonaktifkan. Set ADMIN_DIAGNOSTIC_SECRET untuk mengaktifkan.' },
      { status: 403 }
    )
  }

  // Admin-only: verify dedicated secret using Node.js crypto.timingSafeEqual
  const adminSecret = request.headers.get('x-admin-secret')
  if (!adminSecret) {
    return NextResponse.json({ error: 'Secret diperlukan' }, { status: 401 })
  }
  try {
    const a = Buffer.from(adminSecret)
    const b = Buffer.from(diagnosticSecret)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Secret tidak valid' }, { status: 401 })
    }
  } catch {
    // Fallback: constant-time string comparison
    if (adminSecret.length !== diagnosticSecret.length) {
      return NextResponse.json({ error: 'Secret tidak valid' }, { status: 401 })
    }
    let result = 0
    for (let i = 0; i < adminSecret.length; i++) {
      result |= adminSecret.charCodeAt(i) ^ diagnosticSecret.charCodeAt(i)
    }
    if (result !== 0) {
      return NextResponse.json({ error: 'Secret tidak valid' }, { status: 401 })
    }
  }

  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Find user — only select fields needed for diagnostics
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        isActive: true,
        isVerified: true,
        twoFactorEnabled: true,
        password: true, // Only to check if it EXISTS, never exposed
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    })

    if (!user) {
      return NextResponse.json({
        found: false,
        diagnosis: 'User tidak ditemukan dengan email ini',
      })
    }

    // Determine diagnosis — only account status, NO password verification
    let diagnosis: string
    if (!user.isActive) {
      diagnosis = 'Akun diblokir'
    } else if (user.lockedUntil && new Date() < user.lockedUntil) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      diagnosis = `Akun dikunci karena terlalu banyak percobaan gagal. Coba lagi dalam ${remainingMinutes} menit.`
    } else if (!user.isVerified) {
      diagnosis = 'Email belum diverifikasi. Minta user cek email atau gunakan resend-verification.'
    } else if (!user.password) {
      diagnosis = 'Akun OAuth (tidak ada password). User harus login via Google atau atur password melalui forgot-password.'
    } else if (user.failedLoginAttempts > 5) {
      diagnosis = `Ada ${user.failedLoginAttempts} percobaan login gagal. Password mungkin salah, atau ada percobaan brute-force.`
    } else {
      diagnosis = 'Akun aktif dan terverifikasi. Jika login gagal, kemungkinan password salah — arahkan user ke forgot-password.'
    }

    // SECURITY: Only return SAFE diagnostic info — no userId, no password details
    return NextResponse.json({
      found: true,
      isActive: user.isActive,
      isVerified: user.isVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      hasPassword: !!user.password, // Boolean only, no hash details
      isLocked: !!(user.lockedUntil && new Date() < user.lockedUntil),
      failedLoginAttempts: user.failedLoginAttempts,
      diagnosis,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Login diagnostic error')
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
