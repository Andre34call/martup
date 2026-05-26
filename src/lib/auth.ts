import type { NextAuthOptions } from 'next-auth'
import { logger } from '@/lib/logger'
import { env } from '@/lib/env'
import GoogleProvider from 'next-auth/providers/google'

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
        const response = await fetch(`${env.NEXTAUTH_URL}/api/auth/sync-user`, {
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
          logger.warn({ component: 'auth', error: data.error }, 'Failed to sync user')
        }
      } catch (error) {
        logger.warn({ component: 'auth', err: error }, 'Error syncing user')
      }
      return true
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  secret: env.NEXTAUTH_SECRET || undefined,
}
