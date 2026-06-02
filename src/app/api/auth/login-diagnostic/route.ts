import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySuperAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/login-diagnostic - Diagnose login failures (super-admin-only).
 *
 * SECURITY OVERHAUL (SEC-9):
 * - Uses verifySuperAdmin instead of raw secret comparison
 * - Removed ALL password hash info (hashPrefix, passwordLength, looksLikeBcrypt)
 * - Removed auto-fix capability (auto-hashing plaintext passwords)
 * - Only returns basic diagnostic info: found, isActive, isVerified, twoFactorEnabled, diagnosis
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  // Super-admin-only: verify via auth middleware
  const authResult = await verifySuperAdmin(request)
  if (!authResult.success) {
    return authErrorResponse(authResult)
  }

  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email wajib diisi' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Find user
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: { seller: true, wallet: true },
    })

    if (!user) {
      // Try case-insensitive (SQLite doesn't support Prisma mode:insensitive, use contains as fallback)
      const userByInsensitive = await db.user.findFirst({
        where: { email: { contains: normalizedEmail } },
      })

      return NextResponse.json({
        found: false,
        emailSearched: normalizedEmail,
        caseInsensitiveMatch: userByInsensitive
          ? { id: userByInsensitive.id, email: userByInsensitive.email, isVerified: userByInsensitive.isVerified }
          : null,
        diagnosis: 'User tidak ditemukan dengan email ini',
      })
    }

    // Build diagnosis
    let diagnosis: string
    if (!user.isActive) {
      diagnosis = 'Akun diblokir'
    } else if (!user.isVerified) {
      diagnosis = 'Email belum diverifikasi'
    } else if (!user.password) {
      diagnosis = 'Tidak ada password (akun OAuth saja)'
    } else {
      diagnosis = 'Password tidak cocok — periksa apakah password benar'
    }

    // Return only safe diagnostic info — NO password hash details
    return NextResponse.json({
      found: true,
      isActive: user.isActive,
      isVerified: user.isVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      diagnosis,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Login diagnostic error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
