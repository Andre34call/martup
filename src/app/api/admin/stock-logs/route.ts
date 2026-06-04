import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// GET /api/admin/stock-logs - Fetch stock change history with filtering
// NOTE: StockLog model is not yet implemented. Returns 501 until model is added.
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    return NextResponse.json(
      { success: false, error: 'Fitur stock logs belum diimplementasi.' },
      { status: 501 }
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'Admin stock logs GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
