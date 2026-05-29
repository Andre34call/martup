import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
// GET /api/auth/me - Get current authenticated user
// Supports two auth methods:
// 1. NextAuth session (Google OAuth) — via verifyAuth
// 2. HMAC-signed bearer token (email/password) — via verifyAuth
//
// FALLBACK: If a Google OAuth user exists in NextAuth session but NOT in our DB
// (sync-user failed during signIn callback), we create the user here.
export async function GET(request: NextRequest) {
  try {
    // Use verifyAuth which checks both NextAuth session and HMAC bearer token
    const authResult = await verifyAuth(request)

    if (!authResult.success) {
      // FALLBACK: Check if there's a NextAuth session with a user that doesn't exist in our DB
      // This can happen if the sync-user call failed during Google OAuth signIn
      try {
        const session = await getServerSession(authOptions)
        if (session?.user) {
          const userEmail = (session.user as any).email
          if (userEmail) {
            // Check if user exists in DB
            const existingUser = await db.user.findUnique({
              where: { email: userEmail.toLowerCase() },
            })

            if (!existingUser) {
              // User has a valid NextAuth session but no DB record — create one
              logger.info({ component: 'auth', email: userEmail }, 'Creating missing user from NextAuth session fallback')

              const newUser = await db.user.create({
                data: {
                  email: userEmail.toLowerCase(),
                  name: (session.user as any).name || userEmail.split('@')[0],
                  avatar: (session.user as any).image || null,
                  role: 'buyer',
                  isVerified: true, // Google verified their email
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

              // Welcome notification
              await db.notification.create({
                data: {
                  userId: newUser.id,
                  title: 'Selamat Datang di MartUp! 🎉',
                  content: 'Terima kasih telah bergabung. Mulai belanja atau jual produk sekarang!',
                  type: 'system',
                  isRead: false,
                },
              })

              const { password: _, ...userWithoutPassword } = newUser
              return NextResponse.json({
                success: true,
                user: userWithoutPassword,
              })
            }
          }
        }
      } catch (fallbackError) {
        logger.warn({ component: 'auth', err: fallbackError }, 'Fallback user creation from NextAuth session failed')
      }

      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // Get full user data from DB (verifyAuth only returns basic fields)
    const user = await db.user.findUnique({
      where: { id: authResult.user.id },
      include: {
        seller: true,
        wallet: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
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

    // Include Super Admin flag for frontend
    const userIsSuperAdmin = isSuperAdmin(user.role, user.email)

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      isSuperAdmin: userIsSuperAdmin,
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
