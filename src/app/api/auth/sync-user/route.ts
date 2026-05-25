import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, generateAuthToken } from '@/lib/auth-middleware'

// POST /api/auth/sync-user - Sync user from Google OAuth
// For Google: called by NextAuth signIn callback (requires x-internal-secret)
// For Phone: DEPRECATED - use /api/auth/otp/send and /api/auth/otp/verify instead
// This endpoint should NOT be used for email/password login - use /api/auth/login instead.
// SECURITY: Phone OTP login no longer goes through this endpoint.
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
    const { email, name, avatar, phone, provider, providerAccountId } = body

    // SECURITY: Only allow this endpoint for OAuth providers
    // Phone OTP should use /api/auth/otp/send + /api/auth/otp/verify
    const allowedProviders = ['google']
    if (provider && !allowedProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'This endpoint is only for OAuth authentication. Use /api/auth/otp for phone login or /api/auth/login for email/password.' },
        { status: 400 }
      )
    }

    // If no provider specified, reject (prevents random account creation)
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider is required. Use /api/auth/login for email/password authentication.' },
        { status: 400 }
      )
    }

    // SECURITY: For Google OAuth, verify internal secret (only NextAuth callback should call this)
    const internalSecret = request.headers.get('x-internal-secret')
    const expectedSecret = process.env.NEXTAUTH_SECRET
    if (!expectedSecret || internalSecret !== expectedSecret) {
      console.warn(`[SECURITY] sync-user called without valid internal secret from IP: ${clientIp}`)
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid internal authentication' },
        { status: 401 }
      )
    }

    // Validate required fields based on provider
    if (provider === 'google' && !email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 })
    }

    // Google OAuth flow (existing logic)
    // Check if user exists by email
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

    // Fetch updated user with all relations (exclude password hash)
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        isVerified: true,
        isActive: true,
        loyaltyPoints: true,
        coins: true,
        referralCode: true,
        dailyCheckIn: true,
        divisionId: true,
        createdAt: true,
        updatedAt: true,
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
