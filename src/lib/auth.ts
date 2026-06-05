import type { NextAuthOptions } from 'next-auth'
import { logger } from '@/lib/logger'
import { env } from '@/lib/env'
import GoogleProvider from 'next-auth/providers/google'
import { db } from '@/lib/db'

// ==================== NEXTAUTH_URL AUTO-FIX ====================
// NextAuth v4 reads NEXTAUTH_URL from process.env for OAuth callbacks.
// On Vercel, the VERCEL_URL env var is auto-set to the DEPLOYMENT-SPECIFIC URL
// (e.g., martup-v05rcrto2-xxx.vercel.app), which changes with every deployment.
// We MUST ensure NEXTAUTH_URL stays as the CANONICAL URL (e.g., https://martup-seven.vercel.app)
// so the Google OAuth redirect URI matches what's configured in Google Cloud Console.
//
// IMPORTANT: Only override NEXTAUTH_URL if it's not set or is localhost.
// Never replace a valid canonical URL with the deployment-specific VERCEL_URL.
if (process.env.VERCEL) {
  const deploymentUrl = `https://${process.env.VERCEL_URL}`
  const currentUrl = process.env.NEXTAUTH_URL
  
  if (!currentUrl || currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
    // NEXTAUTH_URL not set or localhost → use deployment URL as fallback
    process.env.NEXTAUTH_URL = deploymentUrl
    logger.info({ component: 'auth', from: currentUrl || '(not set)', to: deploymentUrl }, 'NEXTAUTH_URL auto-corrected (fallback to VERCEL_URL)')
  } else {
    // NEXTAUTH_URL is already set to a valid URL → keep it!
    // This is the canonical URL (e.g., https://martup-seven.vercel.app)
    logger.info({ component: 'auth', nextauthUrl: currentUrl, vercelUrl: deploymentUrl }, 'NEXTAUTH_URL preserved (canonical URL takes priority over deployment URL)')
  }
}

// ==================== GOOGLE OAUTH DIAGNOSTICS ====================
// Log diagnostic info at startup to help debug Google OAuth issues
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const nextauthSecret = process.env.NEXTAUTH_SECRET
const nextauthUrl = process.env.NEXTAUTH_URL

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  if (!googleClientId || !googleClientSecret) {
    console.error(
      '[AUTH ERROR] Google OAuth is NOT configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your Vercel Dashboard → Settings → Environment Variables. ' +
      'Google login will NOT work without these.'
    )
  } else {
    logger.info({ component: 'auth' }, 'Google OAuth configured')
  }
  if (!nextauthSecret) {
    console.error(
      '[AUTH ERROR] NEXTAUTH_SECRET is NOT set. Session tokens and OAuth will NOT work. ' +
      'Set NEXTAUTH_SECRET in your Vercel Dashboard → Settings → Environment Variables.'
    )
  }
  if (!nextauthUrl || nextauthUrl.includes('localhost')) {
    console.warn(
      `[AUTH WARN] NEXTAUTH_URL is "${nextauthUrl || '(not set)'}". On Vercel, this should be your production URL (e.g., https://martup-seven.vercel.app). ` +
      'It has been auto-corrected to VERCEL_URL if available.'
    )
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId || '',
      clientSecret: googleClientSecret || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    // No maxAge — the JWT is validated by the session cookie lifetime instead.
    // When the browser closes, the next-auth.session-token session cookie is deleted,
    // and the user must re-authenticate. This provides "sticky login" behavior:
    // - Refresh page → still logged in ✅
    // - Close tab → still logged in ✅
    // - Close browser → logged out ✅
  },
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // Intentionally NO maxAge → session cookie (cleared when browser closes)
        // This ensures Google OAuth users also get the "sticky login" behavior
      },
    },
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        logger.info({ component: 'auth', email: user.email, provider: account.provider }, 'JWT callback: initial sign-in')
        token.accessToken = account.access_token
        token.provider = account.provider
        // SECURITY: Store tokenVersion from DB at sign-in time so we can
        // detect password changes on subsequent JWT refreshes.
        if (user.email) {
          try {
            const dbUser = await db.user.findUnique({
              where: { email: user.email },
              select: { tokenVersion: true },
            })
            token.tokenVersion = dbUser?.tokenVersion ?? 0
            logger.info({ component: 'auth', email: user.email, tokenVersion: token.tokenVersion }, 'JWT callback: tokenVersion fetched from DB')
          } catch (error) {
            logger.error({ component: 'auth', err: error, email: user.email }, 'JWT callback: DB query failed during sign-in')
            // Don't block sign-in — tokenVersion will be checked on next refresh
            token.tokenVersion = 0
          }
        }
      }

      // SECURITY: On every JWT refresh, check tokenVersion and account status.
      // IMPORTANT: We do NOT invalidate the session if the user doesn't exist in our DB yet.
      // This happens when sync-user failed during signIn (e.g., serverless cold start timeout).
      // The user was authenticated by Google — their JWT is valid. /api/auth/me will
      // create the DB user as a fallback. Invalidating here breaks Google OAuth entirely.
      if (token.email) {
        try {
          const dbUser = await db.user.findUnique({
            where: { email: token.email as string },
            select: { tokenVersion: true, isActive: true },
          })

          // User not in DB yet — don't invalidate! sync-user may have failed.
          // /api/auth/me will create the user as fallback.
          // Just keep the token as-is and retry on next refresh.
          if (!dbUser) {
            logger.info({ component: 'auth', email: token.email }, 'JWT refresh: user not in DB yet — keeping session alive, /api/auth/me will create user')
          } else if (!dbUser.isActive) {
            // User explicitly deactivated — THIS is when we invalidate
            logger.info({ component: 'auth', email: token.email }, 'NextAuth JWT invalidated — account deactivated')
            return { ...token, email: undefined, sub: undefined } as any
          } else if (dbUser.tokenVersion !== (token.tokenVersion as number)) {
            // tokenVersion changed since last sign-in/refresh — password was changed
            logger.info({ component: 'auth', email: token.email }, 'NextAuth JWT invalidated — tokenVersion mismatch')
            return { ...token, email: undefined, sub: undefined } as any
          }

          // Keep tokenVersion in sync (in case it was missing from older tokens)
          if (dbUser) {
            token.tokenVersion = dbUser.tokenVersion
          }
        } catch (error) {
          // DB unreachable — don't invalidate the session just because the DB is down
          // The tokenVersion check will be retried on the next JWT refresh
          logger.error({ component: 'auth', err: error }, 'JWT callback: DB query failed on refresh — keeping session alive')
        }
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client
      // If token is empty (session invalidated), return null to force re-auth
      if (!token.email) {
        return { ...session, user: null } as any
      }
      if (session.user) {
        (session.user as any).id = token.sub
      }
      return session
    },
    async signIn({ user, account, profile }) {
      logger.info({
        component: 'auth',
        email: user?.email,
        name: user?.name,
        provider: account?.provider,
        providerAccountId: account?.providerAccountId,
        hasAccessToken: !!account?.access_token,
      }, 'signIn callback triggered')

      // Check if Google OAuth is properly configured
      if (!googleClientId || !googleClientSecret) {
        logger.error({ component: 'auth' }, 'Google OAuth credentials not configured — cannot sign in with Google')
        return '/?error=google_oauth_not_configured'
      }

      // Sync user DIRECTLY to our database (no HTTP fetch — avoids serverless cold start issues)
      // Previously used fetch('/api/auth/sync-user') which could fail due to cold start timeout
      try {
        const internalSecret = env.INTERNAL_API_SECRET
        if (!internalSecret) {
          logger.error({ component: 'auth' }, 'INTERNAL_API_SECRET not set — skipping direct DB sync')
        } else {
          const normalizedEmail = (user.email as string).toLowerCase()
          const existingUser = await db.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, isActive: true, tokenVersion: true },
          })

          if (!existingUser) {
            // Create new user directly in DB
            const newUser = await db.user.create({
              data: {
                email: normalizedEmail,
                name: (user.name as string) || normalizedEmail.split('@')[0],
                avatar: user.image || null,
                role: 'buyer',
                isVerified: true, // Google verified their email
                wallet: {
                  create: { balance: 0, holdBalance: 0 },
                },
              },
              select: { id: true },
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

            logger.info({ component: 'auth', email: normalizedEmail, userId: newUser.id }, 'Google OAuth user created directly in DB (signIn callback)')
          } else if (!existingUser.isActive) {
            // User is blocked — deny login
            logger.warn({ component: 'auth', email: normalizedEmail }, 'Google OAuth user is blocked — denying login')
            return '/?error=AccessDenied'
          } else {
            // Update existing user info from Google
            if (user.name && user.name !== (await db.user.findUnique({ where: { id: existingUser.id }, select: { name: true } }))?.name) {
              await db.user.update({
                where: { id: existingUser.id },
                data: { name: user.name, avatar: user.image || undefined },
              })
            }
            logger.info({ component: 'auth', email: normalizedEmail }, 'Google OAuth user already exists in DB')
          }
        }
      } catch (dbError) {
        // DB error during direct sync — don't block sign-in
        // /api/auth/me will handle user creation as fallback
        logger.warn({ component: 'auth', err: dbError, email: user.email }, 'Direct DB sync failed — fallback to /api/auth/me')
      }

      // Always allow sign-in — /api/auth/me handles fallback user creation
      logger.info({ component: 'auth', email: user.email }, 'signIn callback: allowing sign-in')
      return true
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      // If the callback URL is on a different origin (e.g., Vercel deployment URL),
      // redirect to the base URL instead to avoid CORS/cookie issues
      logger.info({ component: 'auth', url, baseUrl }, 'redirect callback: redirecting to baseUrl')
      return baseUrl
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  debug: process.env.NODE_ENV === 'development',
  secret: nextauthSecret || undefined,
}
