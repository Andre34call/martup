import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/admin/bank-accounts — List all platform bank accounts (including inactive), sorted by sortOrder
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const bankAccounts = await db.platformBankAccount.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ success: true, data: bankAccounts })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Admin bank-accounts GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/admin/bank-accounts — Create a new platform bank account
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { bankName, bankCode, accountNumber, accountHolder, branch, isActive, isDefault, sortOrder } =
      body as Record<string, unknown>

    // Validate required fields
    if (!bankName || typeof bankName !== 'string' || bankName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'bankName is required' },
        { status: 400 }
      )
    }
    if (!accountNumber || typeof accountNumber !== 'string' || accountNumber.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'accountNumber is required' },
        { status: 400 }
      )
    }
    if (!accountHolder || typeof accountHolder !== 'string' || accountHolder.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'accountHolder is required' },
        { status: 400 }
      )
    }

    // If setting as default, unset all other defaults first
    const shouldSetDefault = isDefault === true
    if (shouldSetDefault) {
      await db.platformBankAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const bankAccount = await db.platformBankAccount.create({
      data: {
        bankName: bankName.trim(),
        bankCode: (bankCode as string)?.trim() || null,
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        branch: (branch as string)?.trim() || null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        isDefault: shouldSetDefault,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      },
    })

    return NextResponse.json({ success: true, data: bankAccount }, { status: 201 })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Admin bank-accounts POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
