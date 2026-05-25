import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      isVerified: boolean
      loyaltyPoints: number
      coins: number
      referralCode: string | null
      avatar: string | null
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role?: string
    isVerified?: boolean
    loyaltyPoints?: number
    coins?: number
    referralCode?: string | null
    avatar?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    role: string
    isVerified: boolean
    loyaltyPoints: number
    coins: number
    referralCode: string | null
    avatar: string | null
  }
}
