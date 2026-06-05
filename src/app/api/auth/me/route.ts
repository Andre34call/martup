import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, generateAuthToken } from '@/lib/auth-middleware'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import { authLimiter } from '@/lib/rate-limit'
import { setSessionCookies, REMEMBER_FLAG_COOKIE_NAME, SESSION_COOKIE_NAME, AUTH_FLAG_COOKIE_NAME } from '@/lib/session-cookie'
// GET /api/auth/me - Get current authenticated user
// Supports three auth methods:
// 1. NextAuth session (Google OAuth) — via verifyAuth
// 2. HMAC-signed session cookie (email/password — sticky login)
// 3. HMAC-signed bearer token (email/password — API fallback)
//
// IMPORTANT: For NextAuth (Google OAuth) users, this endpoint also sets
// martup_session + martup_auth cookies so that on page refresh, the
// DataFetcher can detect the session via Path 1 (session cookie) without
// relying solely on useSession() which may have timing issues.
//
// FALLBACK: If a Google OAuth user exists in NextAuth session but NOT in our DB
// (sync-user failed during signIn callback), we create the user here.
export async function GET(request: NextRequest) {
  try {
    // Check if the request is coming from a NextAuth session
    // (has next-auth.session-token cookie but no martup_session cookie)
    const hasNextAuthCookie = !!request.cookies.get('next-auth.session-token')?.value
    const hasMartupSessionCookie = !!request.cookies.get(SESSION_COOKIE_NAME)?.value

    // Use verifyAuth which checks NextAuth session, HMAC session cookie, and bearer token
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
              // SECURITY: Rate limit fallback user creation to prevent abuse
              const fallbackIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
              const fallbackRateLimit = await authLimiter.check(`me-create:${fallbackIp}`)
              if (!fallbackRateLimit.allowed) {
                logger.warn({ component: 'auth', email: userEmail, ip: fallbackIp }, 'Fallback user creation rate limited')
                return NextResponse.json(
                  { success: false, error: 'Terlalu banyak request. Coba lagi nanti.' },
                  { status: 429 }
                )
              }

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
              const response = NextResponse.json({
                success: true,
                user: userWithoutPassword,
              })

              // Set martup_session + martup_auth cookies for NextAuth users
              // so that on page refresh, DataFetcher Path 1 can detect the session
              const authToken = generateAuthToken(newUser.id, newUser.tokenVersion ?? 0)
              setSessionCookies(response, authToken, false)
              logger.info({ component: 'auth', userId: newUser.id }, 'Set martup session cookies for NextAuth fallback user')

              return response
            }

            // User EXISTS in DB but verifyAuth still failed — this means the NextAuth session
            // validated but something went wrong in verifyAuth. Most likely: the user has a
            // valid next-auth.session-token but verifyAuth's NextAuth path failed silently.
            // Try returning user data directly from the NextAuth session.
            if (existingUser && existingUser.isActive) {
              const { password: _, ...userWithoutPassword } = existingUser
              const userIsSuperAdmin = isSuperAdmin(existingUser.role, existingUser.email)
              const response = NextResponse.json({
                success: true,
                user: userWithoutPassword,
                isSuperAdmin: userIsSuperAdmin,
              })

              // Set martup_session + martup_auth cookies for NextAuth users
              const authToken = generateAuthToken(existingUser.id, existingUser.tokenVersion ?? 0)
              setSessionCookies(response, authToken, false)
              logger.info({ component: 'auth', userId: existingUser.id }, 'Set martup session cookies for existing NextAuth user (verifyAuth failed but session valid)')

              return response
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
        { success: false, error: 'Pengguna tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if user is blocked
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Akun telah diblokir' },
        { status: 403 }
      )
    }

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user

    // SECURITY NOTE: isSuperAdmin is only included in the response for the
    // user's OWN data (login/register/me endpoints). It is NOT exposed in any
    // API that returns other users' data (e.g., admin user listing). This flag
    // is needed by the frontend to show admin navigation. The user's role
    // (e.g., 'admin') is already exposed in the response, so isSuperAdmin does
    // not reveal additional privilege information beyond what role already shows.
    const userIsSuperAdmin = isSuperAdmin(user.role, user.email)

    const response = NextResponse.json({
      success: true,
      user: userWithoutPassword,
      isSuperAdmin: userIsSuperAdmin,
    })

    // For NextAuth users who don't have martup_session cookie yet,
    // set our custom session cookies so that on page refresh,
    // DataFetcher Path 1 (session cookie) can detect the session.
    // This is critical because useSession() may have timing issues
    // and the martup_auth cookie is needed for quick auth detection.
    if (hasNextAuthCookie && !hasMartupSessionCookie) {
      const authToken = generateAuthToken(user.id, user.tokenVersion ?? 0)
      setSessionCookies(response, authToken, false)
      logger.info({ component: 'auth', userId: user.id }, 'Set martup session cookies for NextAuth user (first /me call)')
    }

    // TOKEN ROTATION: When the token is older than the rotation threshold,
    // we issue a fresh token in the response cookies. This limits the window
    // of opportunity for stolen cookies (especially with Remember Me).
    if (authResult.shouldRotateToken) {
      const freshToken = generateAuthToken(user.id, user.tokenVersion ?? 0)
      // Check if the current session has Remember Me enabled
      // Use the dedicated martup_remember flag cookie (not martup_auth which is always "1")
      const rememberMeCookie = request.cookies.get(REMEMBER_FLAG_COOKIE_NAME)
      const isRememberMe = !!rememberMeCookie?.value
      setSessionCookies(response, freshToken, isRememberMe)
      logger.info({ component: 'auth', userId: user.id, isRememberMe }, 'Token rotated (session cookie refreshed)')
    }

    return response
  } catch (error: any) {
    logger.error({ err: error, code: error?.code }, 'Get current user error')
    
    // SECURITY: Only expose specific database error details in development.
    // In production, return a generic message to avoid leaking infrastructure info.
    const isDev = process.env.NODE_ENV === 'development'
    const errorMessage = isDev && (error?.code === 'P1001' || error?.code === 'P1002')
      ? 'Database tidak dapat diakses. Pastikan SUPABASE_DATABASE_URL sudah dikonfigurasi.'
      : 'Terjadi kesalahan server'
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
