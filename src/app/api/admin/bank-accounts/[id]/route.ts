import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

interface RouteContext {
  params: Promise<{ id: string }>
}

// PUT /api/admin/bank-accounts/[id] — Update a platform bank account
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const { id } = await context.params
    const body = await request.json()
    const { bankName, bankCode, accountNumber, accountHolder, branch, isActive, isDefault, sortOrder } =
      body as Record<string, unknown>

    // Verify the bank account exists
    const existing = await db.platformBankAccount.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Rekening bank tidak ditemukan' },
        { status: 404 }
      )
    }

    // If setting as default, unset all other defaults first
    const shouldSetDefault = isDefault === true
    if (shouldSetDefault) {
      await db.platformBankAccount.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const updateData: Record<string, unknown> = {}
    if (bankName !== undefined) {
      if (typeof bankName !== 'string' || bankName.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'bankName cannot be empty' },
          { status: 400 }
        )
      }
      updateData.bankName = bankName.trim()
    }
    if (bankCode !== undefined) updateData.bankCode = (bankCode as string)?.trim() || null
    if (accountNumber !== undefined) {
      if (typeof accountNumber !== 'string' || accountNumber.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'accountNumber cannot be empty' },
          { status: 400 }
        )
      }
      updateData.accountNumber = accountNumber.trim()
    }
    if (accountHolder !== undefined) {
      if (typeof accountHolder !== 'string' || accountHolder.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'accountHolder cannot be empty' },
          { status: 400 }
        )
      }
      updateData.accountHolder = accountHolder.trim()
    }
    if (branch !== undefined) updateData.branch = (branch as string)?.trim() || null
    if (isActive !== undefined) updateData.isActive = isActive
    if (isDefault !== undefined) updateData.isDefault = shouldSetDefault
    if (sortOrder !== undefined) updateData.sortOrder = typeof sortOrder === 'number' ? sortOrder : 0

    const bankAccount = await db.platformBankAccount.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: bankAccount })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Admin bank-accounts PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/bank-accounts/[id] — Soft-delete (set isActive=false)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const { id } = await context.params

    // Verify the bank account exists
    const existing = await db.platformBankAccount.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Rekening bank tidak ditemukan' },
        { status: 404 }
      )
    }

    // Soft-delete: set isActive=false instead of hard-deleting
    const bankAccount = await db.platformBankAccount.update({
      where: { id },
      data: { isActive: false },
    })

    // If the deleted account was the default, unset it
    if (existing.isDefault) {
      await db.platformBankAccount.update({
        where: { id },
        data: { isDefault: false },
      })
    }

    return NextResponse.json({ success: true, data: bankAccount })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Admin bank-accounts DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
