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
    console.log(`[AUTH FIX] NEXTAUTH_URL auto-corrected: ${currentUrl || '(not set)'} → ${correctUrl}`)
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  session: {
    strategy: 'jwt',
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
      // Sync user to our database
      try {
        // SECURITY: Add internal secret to verify this is from NextAuth callback, not external caller
        const internalSecret = env.NEXTAUTH_SECRET
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
        const data = await response.json()
        if (!data.success) {
          logger.warn({ component: 'auth', error: data.error, email: user.email }, 'Failed to sync Google user — /api/auth/me will create user as fallback')
        }
      } catch (error) {
        logger.warn({ component: 'auth', err: error, email: user.email }, 'Error syncing Google user — /api/auth/me will create user as fallback')
      }
      return true // Always allow sign-in — /api/auth/me handles fallback user creation
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  secret: env.NEXTAUTH_SECRET || undefined,
}
