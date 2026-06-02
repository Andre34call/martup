import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/bank-accounts — Public: list active platform bank accounts for buyer-facing display
// No auth required. Only returns accounts where isActive=true, sorted by sortOrder.
export async function GET() {
  try {
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
