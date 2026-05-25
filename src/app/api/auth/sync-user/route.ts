import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit } from '@/lib/auth-middleware'

// POST /api/auth/sync-user - Sync user from Google OAuth ONLY
// This endpoint is ONLY meant to be called by NextAuth signIn callback
// for Google OAuth users. It should NOT be used for email/password auth.
export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`sync-user:${clientIp}`)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email, name, avatar, provider, providerAccountId } = body

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 })
    }

    // SECURITY: Only allow this endpoint for OAuth providers (Google, etc.)
    // NOT for email/password login - that goes through /api/auth/login
    const allowedProviders = ['google']
    if (provider && !allowedProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'This endpoint is only for OAuth authentication. Use /api/auth/login for email/password.' },
        { status: 400 }
      )
    }

    // If no provider specified, also reject (prevents random email creation)
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider is required. Use /api/auth/login for email/password authentication.' },
        { status: 400 }
      )
    }

    // SECURITY: Verify internal secret - only NextAuth callback should call this
    const internalSecret = request.headers.get('x-internal-secret')
    const expectedSecret = process.env.NEXTAUTH_SECRET
    if (!expectedSecret || internalSecret !== expectedSecret) {
      console.warn(`[SECURITY] sync-user called without valid internal secret from IP: ${clientIp}`)
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid internal authentication' },
        { status: 401 }
      )
    }

    // Check if user exists
    let user = await db.user.findUnique({
      where: { email },
      include: {
        seller: true,
        wallet: true,
      },
    })

    if (!user) {
      // Create new user via OAuth - CLEAN SLATE (no orders, no notifications, no products)
      user = await db.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          avatar: avatar || null,
          role: 'buyer', // ALWAYS buyer by default - NEVER admin
          isVerified: true, // OAuth users are pre-verified (Google verified their email)
          wallet: {
            create: {
              balance: 0,
              holdBalance: 0,
            },
          },
        },
        include: {
          seller: true,
          wallet: true,
        },
      })

      // Welcome notification for new users
      await db.notification.create({
        data: {
          userId: user.id,
          title: 'Selamat Datang di MartUp! 🎉',
          content: 'Terima kasih telah bergabung. Mulai belanja atau jual produk sekarang!',
          type: 'system',
          isRead: false,
        },
      })
    } else {
      // Update existing user info from Google
      if (name && name !== user.name) {
        await db.user.update({
          where: { id: user.id },
          data: { name, avatar: avatar || user.avatar },
        })
      }

      // Check if user is blocked
      if (!user.isActive) {
        return NextResponse.json(
          { success: false, error: 'Akun Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut.' },
          { status: 403 }
        )
      }
    }

    // Fetch updated user with all relations
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        seller: true,
        wallet: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: fullUser,
      isNewUser: !user.wallet || user.createdAt === user.updatedAt,
    })
  } catch (error: any) {
    console.error('Sync user error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
