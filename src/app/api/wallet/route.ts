import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'

// ==================== WALLET ====================
// GET: Fetch wallet for a user (authenticated, ownership verified)
// POST: DEPRECATED — use /api/wallet/deposit for top-ups (requires payment verification)

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Users can only access their own wallet
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only access your own wallet' },
        { status: 403 }
      )
    }

    const wallet = await db.wallet.findUnique({
      where: { userId },
      include: {
        mutations: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: wallet,
    }))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Wallet GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/wallet — Redirected to /api/wallet/deposit (requires payment verification)
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // DEPRECATED: Use /api/wallet/deposit instead (requires payment verification)
    return NextResponse.json(
      {
        success: false,
        error: 'Gunakan /api/wallet/deposit untuk top up. Top up langsung tanpa verifikasi pembayaran tidak diizinkan.',
        redirect: '/api/wallet/deposit',
      },
      { status: 400 }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
