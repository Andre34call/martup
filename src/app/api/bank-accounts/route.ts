import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// GET /api/bank-accounts — List active platform bank accounts (authenticated only)
// Previously public for escrow payments; now requires authentication since escrow is removed.
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const bankAccounts = await db.platformBankAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        bankName: true,
        bankCode: true,
        accountNumber: true,
        accountHolder: true,
        branch: true,
        isDefault: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ success: true, data: bankAccounts })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Public bank-accounts GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
