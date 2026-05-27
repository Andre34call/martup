import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

import { logger } from '@/lib/logger'
// GET /api/auth/me - Get current authenticated user from NextAuth session
// This is called client-side after Google OAuth to get user data
// If the user doesn't exist in DB yet (sync-user failed), create them here
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    let user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        seller: true,
        wallet: true,
      },
    })

    // If user doesn't exist in DB yet (sync-user might have failed),
    // create them here as a fallback - always as buyer role
    if (!user) {
      user = await db.user.create({
        data: {
          email: session.user.email,
          name: session.user.name || session.user.email.split('@')[0],
          avatar: session.user.image || null,
          role: 'buyer', // ALWAYS buyer - admin must be promoted via admin panel
          isVerified: true, // Google OAuth users are pre-verified
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

      // Create welcome notification
      await db.notification.create({
        data: {
          userId: user.id,
          title: 'Selamat Datang di MartUp! 🎉',
          content: 'Terima kasih telah bergabung. Mulai belanja atau jual produk sekarang!',
          type: 'system',
          isRead: false,
        },
      })

      logger.info({ component: 'auth', email: session.user.email }, 'User created via /api/auth/me fallback')
    }

    // Check if user is blocked
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is blocked' },
        { status: 403 }
      )
    }

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
    })
  } catch (error: any) {
    logger.error({ err: error, code: error?.code }, 'Get current user error')
    
    // Provide specific error for database connection issues
    const errorMessage = error?.code === 'P1001' || error?.code === 'P1002'
      ? 'Database tidak dapat diakses. Pastikan SUPABASE_DATABASE_URL sudah dikonfigurasi.'
      : 'Internal server error'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
