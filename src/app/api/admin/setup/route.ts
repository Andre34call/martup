import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, verifyAuth, authErrorResponse } from '@/lib/auth-middleware'

// POST /api/admin/setup - Promote a user to admin role
// SECURITY: Requires a secret key AND the requester must already be authenticated
// This prevents random people from making themselves admin
export async function POST(request: NextRequest) {
  try {
    // Rate limit - very strict for admin setup (2 per minute)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`admin-setup:${clientIp}`)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, secret } = body

    // Validate secret - MUST use env var, no fallback in production
    const adminSecret = process.env.ADMIN_SETUP_SECRET
    if (!adminSecret) {
      console.error('[SECURITY] ADMIN_SETUP_SECRET not set in environment!')
      return NextResponse.json(
        { success: false, error: 'Admin setup is not configured. Set ADMIN_SETUP_SECRET env variable.' },
        { status: 500 }
      )
    }

    if (secret !== adminSecret) {
      // Log potential security breach attempt
      console.warn(`[SECURITY] Invalid admin setup attempt from IP: ${clientIp}`)
      return NextResponse.json(
        { success: false, error: 'Invalid secret key' },
        { status: 403 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
      include: { seller: true, wallet: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: `User with email "${email}" not found. The user must register/login first, then be promoted to admin.` },
        { status: 404 }
      )
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Cannot promote a blocked/inactive user to admin.' },
        { status: 403 }
      )
    }

    // Already admin?
    if (user.role === 'admin') {
      return NextResponse.json({
        success: true,
        message: 'User is already an admin',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified,
        },
      })
    }

    // Promote to admin
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        role: 'admin',
        isVerified: true,
      },
    })

    // Log the promotion for audit
    console.log(`[AUDIT] User "${email}" promoted to admin by secret key from IP: ${clientIp}`)

    // Create welcome notification
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Selamat! Anda sekarang Admin 🎉',
        content: 'Akun Anda telah dipromosikan menjadi Admin MartUp. Anda sekarang memiliki akses ke panel admin lengkap.',
        type: 'system',
        isRead: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: `User "${email}" has been promoted to admin successfully!`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin setup error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
