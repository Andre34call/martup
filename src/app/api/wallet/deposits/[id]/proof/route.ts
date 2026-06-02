import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger, logSecurityEvent, logBusinessEvent } from '@/lib/logger'

// POST /api/wallet/deposits/[id]/proof - Upload payment proof for a deposit
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    const { id: depositId } = await params

    if (!checkRateLimit(`deposit-proof:${authResult.user.id}`, 5)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    // Parse the request body first (before transaction)
    const body = await request.json()
    const { proofUrl, senderName } = body as { proofUrl?: string; senderName?: string }

    if (!proofUrl || typeof proofUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL bukti pembayaran diperlukan' },
        { status: 400 }
      )
    }

    // SECURITY: Validate URL is from our Supabase storage — fail closed if env var missing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      logger.error('NEXT_PUBLIC_SUPABASE_URL not configured — cannot validate proof URLs')
      return NextResponse.json(
        { success: false, error: 'Upload bukti pembayaran sedang tidak tersedia' },
        { status: 503 }
      )
    }
    // Also validate it's a proper URL format
    try { new URL(proofUrl) } catch {
      return NextResponse.json(
        { success: false, error: 'URL bukti pembayaran tidak valid' },
        { status: 400 }
      )
    }
    if (!proofUrl.startsWith(supabaseUrl)) {
      return NextResponse.json(
        { success: false, error: 'Bukti pembayaran harus diupload melalui sistem kami' },
        { status: 400 }
      )
    }

    // SECURITY: Sanitize senderName to prevent XSS
    const sanitizedSenderName = senderName
      ? senderName.trim().slice(0, 100).replace(/[<>"'&]/g, '')
      : null

    // SECURITY: Use $transaction to prevent race condition with admin approval
    const updatedDeposit = await db.$transaction(async (tx) => {
      const deposit = await tx.deposit.findUnique({
        where: { id: depositId },
      })

      if (!deposit) {
        throw new Error('NOT_FOUND')
      }

      // SECURITY: Users can only upload proof for their own deposits
      if (deposit.userId !== authResult.user.id) {
        logSecurityEvent({
          event: 'UNAUTHORIZED_PROOF_UPLOAD',
          userId: authResult.user.id,
          details: { depositId, ownerUserId: deposit.userId },
        })
        throw new Error('FORBIDDEN')
      }

      // SECURITY: Can only upload proof for pending/proof_uploaded deposits
      // Check INSIDE transaction to prevent overwriting admin approval
      if (deposit.status !== 'pending' && deposit.status !== 'proof_uploaded') {
        throw new Error(`ALREADY_PROCESSED:${deposit.status}`)
      }

      // Check if deposit has expired
      if (deposit.expiredAt && new Date() > deposit.expiredAt) {
        await tx.deposit.update({
          where: { id: depositId },
          data: { status: 'expired' },
        })
        throw new Error('EXPIRED')
      }

      // Update deposit with proof
      const updated = await tx.deposit.update({
        where: { id: depositId },
        data: {
          proofUrl,
          senderName: sanitizedSenderName,
          status: 'proof_uploaded',
        },
      })

      // Update the related transaction description
      await tx.transaction.updateMany({
        where: { refId: depositId, type: 'deposit', status: 'pending' },
        data: { description: `Deposit via ${deposit.method} — bukti pembayaran diupload, menunggu verifikasi` },
      })

      return updated
    })

    logBusinessEvent({
      event: 'DEPOSIT_PROOF_UPLOADED',
      userId: authResult.user.id,
      details: { depositId, amount: Number(updatedDeposit.amount) },
    })

    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        id: updatedDeposit.id,
        status: updatedDeposit.status,
        proofUrl: updatedDeposit.proofUrl,
        message: 'Bukti pembayaran berhasil diupload. Menunggu verifikasi admin.',
      },
    }))
  } catch (error: unknown) {
    // Handle transaction-level errors (NOT_FOUND, FORBIDDEN, ALREADY_PROCESSED, EXPIRED)
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: 'Deposit tidak ditemukan' },
          { status: 404 }
        )
      }
      if (error.message === 'FORBIDDEN') {
        return NextResponse.json(
          { success: false, error: 'Anda tidak memiliki akses ke deposit ini' },
          { status: 403 }
        )
      }
      if (error.message.startsWith('ALREADY_PROCESSED:')) {
        const currentStatus = error.message.split(':')[1]
        return NextResponse.json(
          { success: false, error: `Deposit sudah diproses dengan status "${currentStatus}"` },
          { status: 400 }
        )
      }
      if (error.message === 'EXPIRED') {
        return NextResponse.json(
          { success: false, error: 'Deposit sudah kadaluarsa. Silakan buat top up baru.' },
          { status: 400 }
        )
      }
    }
    logger.error({ err: error }, 'POST /api/wallet/deposits/[id]/proof error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
