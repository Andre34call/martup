import type { NextAuthOptions } from 'next-auth'
import { logger } from '@/lib/logger'
import { env } from '@/lib/env'
import GoogleProvider from 'next-auth/providers/google'

// ==================== NEXTAUTH_URL AUTO-FIX ====================
// NextAuth v4 reads NEXTAUTH_URL from process.env for OAuth callbacks.
// On Vercel, if NEXTAUTH_URL is not set (or set to localhost), 
// we must override it with VERCEL_URL so callbacks work correctly.
// This runs at module load time, before NextAuth initializes.
if (process.env.VERCEL) {
  const correctUrl = `https://${process.env.VERCEL_URL}`
  const currentUrl = process.env.NEXTAUTH_URL
  
  if (!currentUrl || currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
    process.env.NEXTAUTH_URL = correctUrl
    logger.info({ component: 'auth', from: currentUrl || '(not set)', to: correctUrl }, 'NEXTAUTH_URL auto-corrected')
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
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client
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
        const internalSecret = nextauthSecret
        if (!internalSecret) {
          logger.error({ component: 'auth' }, 'NEXTAUTH_SECRET not set — cannot sync Google OAuth user')
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
