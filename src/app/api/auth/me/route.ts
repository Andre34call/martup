import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'

import { logger } from '@/lib/logger'
// GET /api/auth/me - Get current authenticated user
// Supports two auth methods:
// 1. NextAuth session (Google OAuth) — via verifyAuth
// 2. HMAC-signed bearer token (email/password) — via verifyAuth
export async function GET(request: NextRequest) {
  try {
    // Use verifyAuth which checks both NextAuth session and HMAC bearer token
    const authResult = await verifyAuth(request)

    if (!authResult.success) {
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
