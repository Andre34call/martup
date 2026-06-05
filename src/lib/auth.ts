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
          } catch (error) {
            logger.error({ component: 'auth', err: error }, 'JWT callback: DB query failed during sign-in')
            // Don't block sign-in — tokenVersion will be checked on next refresh
            token.tokenVersion = 0
          }
        }
      }

      // SECURITY: On every JWT refresh, check if tokenVersion has changed.
      // If the user changed their password (incrementing tokenVersion),
      // this session should be invalidated — return an empty token to force re-auth.
      if (token.email) {
        try {
          const dbUser = await db.user.findUnique({
            where: { email: token.email as string },
            select: { tokenVersion: true, isActive: true },
          })
          if (!dbUser || !dbUser.isActive) {
            // User deactivated or deleted — force re-auth by clearing identifying fields
            // Returning a stripped token (no email) causes the session callback to return null
            return { ...token, email: undefined, sub: undefined } as any
          }
          if (dbUser.tokenVersion !== (token.tokenVersion as number)) {
            // tokenVersion changed since last sign-in/refresh — password was changed
            // Force re-auth by clearing identifying fields
            logger.info({ component: 'auth', email: token.email }, 'NextAuth JWT invalidated — tokenVersion mismatch')
            return { ...token, email: undefined, sub: undefined } as any
          }
          // Keep tokenVersion in sync (in case it was missing from older tokens)
          token.tokenVersion = dbUser.tokenVersion
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
      // Check if Google OAuth is properly configured
      if (!googleClientId || !googleClientSecret) {
        logger.error({ component: 'auth' }, 'Google OAuth credentials not configured — cannot sign in with Google')
        // Return false to prevent sign-in without proper configuration
        // This shows an error on the login page instead of silently failing
        return '/?error=google_oauth_not_configured'
      }

      // Sync user to our database
      try {
        // SECURITY: Add internal secret to verify this is from NextAuth callback, not external caller
        const internalSecret = env.INTERNAL_API_SECRET
        if (!internalSecret) {
          logger.error({ component: 'auth' }, 'INTERNAL_API_SECRET not set — cannot sync Google OAuth user')
          return true // Still allow sign-in, /api/auth/me will handle user creation as fallback
        }

        // Build the sync-user URL — must be reachable from the server
        // Priority: VERCEL_URL (auto-set) > NEXTAUTH_URL (manual) > localhost fallback
        let baseUrl: string
        if (process.env.VERCEL_URL) {
          // On Vercel: use the auto-provided VERCEL_URL (always correct)
          baseUrl = `https://${process.env.VERCEL_URL}`
        } else if (env.NEXTAUTH_URL && env.NEXTAUTH_URL !== 'http://localhost:3000') {
          // Custom NEXTAUTH_URL that's not the default localhost
          baseUrl = env.NEXTAUTH_URL
        } else {
          // Local development
          baseUrl = 'http://localhost:3000'
        }

        const syncUrl = `${baseUrl}/api/auth/sync-user`
        logger.info({ component: 'auth', syncUrl, email: user.email }, 'Syncing Google OAuth user')

        const response = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': internalSecret,
          },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
            avatar: user.image,
            provider: account?.provider || 'google',
            providerAccountId: account?.providerAccountId,
          }),
          signal: AbortSignal.timeout(10000), // 10-second timeout
        })

        if (!response.ok) {
          logger.warn({ component: 'auth', status: response.status, email: user.email }, 'sync-user returned non-OK status — fallback to /api/auth/me')
        } else {
          try {
            const data = await response.json()
            if (!data.success) {
              logger.warn({ component: 'auth', error: data.error, email: user.email }, 'Failed to sync Google user — fallback to /api/auth/me')
            } else {
              logger.info({ component: 'auth', email: user.email, isNewUser: data.isNewUser }, 'Google OAuth user synced successfully')
            }
          } catch {
            logger.warn({ component: 'auth', email: user.email }, 'Failed to parse sync-user response — fallback to /api/auth/me')
          }
        }
      } catch (error) {
        logger.warn({ component: 'auth', err: error, email: user.email }, 'Error syncing Google user — fallback to /api/auth/me')
      }

      // Always allow sign-in — /api/auth/me handles fallback user creation
      // The DataFetcher component on the frontend will detect the NextAuth session
      // and call /api/auth/me which creates the user if missing
      return true
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  debug: process.env.NODE_ENV === 'development',
  secret: nextauthSecret || undefined,
}
