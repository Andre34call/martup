import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/login-diagnostic - Diagnose login failures (admin-only).
 *
 * SECURITY IMPROVEMENTS:
 * - Uses a DEDICATED ADMIN_DIAGNOSTIC_SECRET (not TOKEN_SECRET)
 * - Does NOT expose password hash prefixes
 * - Does NOT perform plaintext password comparison
 * - Does NOT auto-fix passwords
 * - Returns only safe diagnostic info
 *
 * Set ADMIN_DIAGNOSTIC_SECRET in env vars. If not set, this endpoint is disabled.
 */
export async function POST(request: NextRequest) {
  // SECURITY: Require a dedicated diagnostic secret — NOT the same as TOKEN_SECRET
  const diagnosticSecret = process.env.ADMIN_DIAGNOSTIC_SECRET
  if (!diagnosticSecret) {
    return NextResponse.json(
      { error: 'Endpoint dinonaktifkan. Set ADMIN_DIAGNOSTIC_SECRET untuk mengaktifkan.' },
      { status: 403 }
    )
  }

  // Admin-only: verify dedicated secret using timing-safe comparison
  const adminSecret = request.headers.get('x-admin-secret')
  if (!adminSecret) {
    return NextResponse.json({ error: 'Secret diperlukan' }, { status: 401 })
  }
  try {
    const a = Buffer.from(adminSecret)
    const b = Buffer.from(diagnosticSecret)
    if (a.length !== b.length || !crypto.subtle.timingSafeEqual?.(a, b)) {
      // Fallback: manual timing-safe compare
      let result = 0
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        result |= (a[i] || 0) ^ (b[i] || 0)
      }
      if (result !== 0 || a.length !== b.length) {
        return NextResponse.json({ error: 'Secret tidak valid' }, { status: 401 })
      }
    }
  } catch {
    // If timingSafeEqual not available, use simple comparison (less secure but functional)
    if (adminSecret !== diagnosticSecret) {
      return NextResponse.json({ error: 'Secret tidak valid' }, { status: 401 })
    }
  }

  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Find user
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isVerified: true,
        twoFactorEnabled: true,
        phone: true,
        password: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        tokenVersion: true,
      },
    })

    if (!user) {
      return NextResponse.json({
        found: false,
        emailSearched: normalizedEmail,
        diagnosis: 'User tidak ditemukan dengan email ini',
      })
    }

    // User found — return SAFE diagnostic info only
    const passwordInfo = {
      hasPassword: !!user.password,
      looksLikeBcrypt: /^\$2[aby]\$\d{2}\$/.test(user.password || ''),
      // SECURITY: Do NOT expose hash prefix or password length
    }

    // Test bcrypt compare if password provided (NO plaintext fallback, NO auto-fix)
    let passwordCheck: { bcryptMatch: boolean } | null = null
    if (body.password && user.password) {
      try {
        const bcryptResult = await bcrypt.compare(body.password, user.password) as unknown as boolean
        passwordCheck = { bcryptMatch: bcryptResult }
      } catch {
        passwordCheck = { bcryptMatch: false }
      }
    }

    // Determine diagnosis
    let diagnosis: string
    if (!user.isActive) {
      diagnosis = 'Akun diblokir'
    } else if (user.lockedUntil && new Date() < user.lockedUntil) {
      diagnosis = `Akun dikunci sampai ${user.lockedUntil.toISOString()}`
    } else if (!user.isVerified) {
      diagnosis = 'Email belum diverifikasi'
    } else if (!passwordInfo.hasPassword) {
      diagnosis = 'Tidak ada password (akun OAuth)'
    } else if (passwordCheck?.bcryptMatch) {
      diagnosis = 'Login seharusnya berhasil'
    } else if (passwordCheck && !passwordCheck.bcryptMatch) {
      diagnosis = 'Password tidak cocok'
    } else if (!passwordInfo.looksLikeBcrypt) {
      diagnosis = 'Format password hash tidak valid — user harus reset password'
    } else {
      diagnosis = 'Periksa password atau coba reset'
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
      failedLoginAttempts: user.failedLoginAttempts,
      isLocked: !!(user.lockedUntil && new Date() < user.lockedUntil),
      passwordInfo,
      passwordCheck,
      diagnosis,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
