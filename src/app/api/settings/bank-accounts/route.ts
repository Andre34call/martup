import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

const SETTINGS_KEY = 'platform_settings'

// GET /api/settings/bank-accounts - Authenticated endpoint for MartUp bank accounts
// Previously public for escrow payments; now requires authentication since escrow is removed.
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const row = await db.platformSetting.findUnique({ where: { key: SETTINGS_KEY } })
    if (!row) {
      return NextResponse.json({ success: true, data: [] })
    }

    const saved = JSON.parse(row.value) as Record<string, unknown>
    let accounts = saved.martupBankAccounts

    // Parse from JSON string if needed
    if (typeof accounts === 'string') {
      try {
        accounts = JSON.parse(accounts as string)
      } catch {
        accounts = []
      }
    }

    if (!Array.isArray(accounts)) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Only return valid, complete bank accounts (all required fields present)
    const validAccounts = accounts.filter(
      (acc: unknown) =>
        acc &&
        typeof acc === 'object' &&
        'bankName' in acc &&
        'accountNumber' in acc &&
        'accountHolder' in acc &&
        typeof (acc as { bankName: unknown }).bankName === 'string' &&
        typeof (acc as { accountNumber: unknown }).accountNumber === 'string' &&
        typeof (acc as { accountHolder: unknown }).accountHolder === 'string' &&
        (acc as { bankName: string }).bankName.trim() !== '' &&
        (acc as { accountNumber: string }).accountNumber.trim() !== '' &&
        (acc as { accountHolder: string }).accountHolder.trim() !== ''
    ).map((acc: Record<string, unknown>) => ({
      type: (acc.type === 'ewallet' ? 'ewallet' : 'bank') as 'bank' | 'ewallet',
      bankName: acc.bankName as string,
      accountNumber: acc.accountNumber as string,
      accountHolder: acc.accountHolder as string,
    }))

    return NextResponse.json({ success: true, data: validAccounts })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Bank accounts GET error')
    return NextResponse.json({ success: true, data: [] })
  }
}
