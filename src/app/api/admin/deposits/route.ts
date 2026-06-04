import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logBusinessEvent } from '@/lib/logger'
import { validateBody, adminDepositActionSchema } from '@/lib/validations'
import { validateCsrfRequest } from '@/lib/csrf'

// GET /api/admin/deposits - List all deposits with user info, support ?status=pending filter
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    const [deposits, total] = await Promise.all([
      db.deposit.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
          platformBankAccount: {
            select: {
              bankName: true,
              accountNumber: true,
              accountHolder: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.deposit.count({ where }),
    ])

    const mapped = deposits.map((d) => ({
      id: d.id,
      userId: d.userId,
      userName: d.user.name,
      userEmail: d.user.email,
      userPhone: d.user.phone,
      userAvatar: d.user.avatar,
      amount: Number(d.amount),
      method: d.method,
      status: d.status,
      proofUrl: d.proofUrl,
      adminNote: d.adminNote,
      platformBankAccount: d.platformBankAccount
        ? { bankName: d.platformBankAccount.bankName, accountNumber: d.platformBankAccount.accountNumber, accountHolder: d.platformBankAccount.accountHolder }
        : null,
      senderName: d.senderName,
      expiredAt: d.expiredAt?.toISOString() || null,
      verifiedAt: d.verifiedAt?.toISOString() || null,
      verifiedBy: d.verifiedBy,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        items: mapped,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Admin deposits GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/deposits - Update deposit status (approve/reject)
// When approving (status='success'), credits the user's wallet balance ATOMICALLY
// SECURITY: Entire operation is wrapped in a $transaction to prevent race conditions
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // SECURITY: CSRF protection
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json({ success: false, error: 'Keamanan request tidak valid. Refresh halaman dan coba lagi.' }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(adminDepositActionSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { depositId, status, adminNote } = validation.data

    // SECURITY: Entire operation including status check is inside $transaction to prevent race conditions
    // (double-credit if two admins approve simultaneously)
    let depositUserId: string | undefined
    const updatedDeposit = await db.$transaction(async (tx) => {
      // Fetch deposit INSIDE transaction to get locked row
      const deposit = await tx.deposit.findUnique({
        where: { id: depositId },
      })

      if (!deposit) {
        throw new Error('NOT_FOUND')
      }

      // Save for logging after transaction
      depositUserId = deposit.userId

      // SECURITY: Check status INSIDE transaction to prevent double-processing
      if (deposit.status !== 'pending' && deposit.status !== 'proof_uploaded') {
        throw new Error(`ALREADY_PROCESSED:${deposit.status}`)
      }

      // If approving, credit the user's wallet atomically
      if (status === 'success') {
        const wallet = await tx.wallet.findUnique({
          where: { userId: deposit.userId },
        })

        if (wallet) {
          const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: deposit.amount } },
          })

          await tx.walletMutation.create({
            data: {
              walletId: wallet.id,
              type: 'credit',
              amount: deposit.amount,
              balance: updatedWallet.balance,
              description: `Top up disetujui - ${deposit.method}`,
              refType: 'deposit',
              refId: deposit.id,
            },
          })
        } else {
          const newWallet = await tx.wallet.create({
            data: {
              userId: deposit.userId,
              balance: deposit.amount,
            },
          })

          await tx.walletMutation.create({
            data: {
              walletId: newWallet.id,
              type: 'credit',
              amount: deposit.amount,
              balance: newWallet.balance,
              description: `Top up disetujui - ${deposit.method}`,
              refType: 'deposit',
              refId: deposit.id,
            },
          })
        }

        // Update corresponding transaction record to 'success'
        await tx.transaction.updateMany({
          where: { refId: deposit.id, type: 'deposit', status: 'pending' },
          data: { status: 'success' },
        })
      }

      // If rejecting, update transaction to 'failed'
      if (status === 'failed') {
        await tx.transaction.updateMany({
          where: { refId: deposit.id, type: 'deposit', status: 'pending' },
          data: { status: 'failed' },
        })
      }

      // Update deposit status with verification tracking
      const updateData: Record<string, unknown> = {
        status,
        verifiedAt: new Date(),
        verifiedBy: authResult.user.id,
      }
      if (adminNote !== undefined) updateData.adminNote = adminNote

      return tx.deposit.update({
        where: { id: depositId },
        data: updateData,
      })
    })

    logBusinessEvent({
      event: 'DEPOSIT_STATUS_CHANGED',
      userId: authResult.user.id,
      details: { depositId, newStatus: status, adminNote, depositUserId },
    })

    return NextResponse.json(serializeDecimal({ success: true, data: updatedDeposit }))
  } catch (error: unknown) {
    // Handle transaction-level errors (NOT_FOUND, ALREADY_PROCESSED)
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: 'Deposit tidak ditemukan' },
          { status: 404 }
        )
      }
      if (error.message.startsWith('ALREADY_PROCESSED:')) {
        const currentStatus = error.message.split(':')[1]
        return NextResponse.json(
          { success: false, error: `Deposit sudah diproses dengan status "${currentStatus}"` },
          { status: 400 }
        )
      }
    }
    logger.error({ err: error }, 'Admin deposits PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
