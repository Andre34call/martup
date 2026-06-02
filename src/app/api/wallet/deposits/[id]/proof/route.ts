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

    // Find the deposit
    const deposit = await db.deposit.findUnique({
      where: { id: depositId },
    })

    if (!deposit) {
      return NextResponse.json(
        { success: false, error: 'Deposit tidak ditemukan' },
        { status: 404 }
      )
    }

    // SECURITY: Users can only upload proof for their own deposits
    if (deposit.userId !== authResult.user.id) {
      logSecurityEvent({
        event: 'UNAUTHORIZED_PROOF_UPLOAD',
        userId: authResult.user.id,
        details: { depositId, ownerUserId: deposit.userId },
      })
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke deposit ini' },
        { status: 403 }
      )
    }

    // Can only upload proof for pending deposits
    if (deposit.status !== 'pending' && deposit.status !== 'proof_uploaded') {
      return NextResponse.json(
        { success: false, error: `Deposit sudah diproses dengan status "${deposit.status}"` },
        { status: 400 }
      )
    }

    // Check if deposit has expired
    if (deposit.expiredAt && new Date() > deposit.expiredAt) {
      await db.deposit.update({
        where: { id: depositId },
        data: { status: 'expired' },
      })
      return NextResponse.json(
        { success: false, error: 'Deposit sudah kadaluarsa. Silakan buat top up baru.' },
        { status: 400 }
      )
    }

    // Parse the request body
    const body = await request.json()
    const { proofUrl, senderName } = body as { proofUrl?: string; senderName?: string }

    if (!proofUrl || typeof proofUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL bukti pembayaran diperlukan' },
        { status: 400 }
      )
    }

    // Validate URL format (must be from our Supabase storage)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl && !proofUrl.startsWith(supabaseUrl)) {
      return NextResponse.json(
        { success: false, error: 'Bukti pembayaran harus diupload melalui sistem kami' },
        { status: 400 }
      )
    }

    // Update deposit with proof
    const updatedDeposit = await db.deposit.update({
      where: { id: depositId },
      data: {
        proofUrl,
        senderName: senderName || null,
        status: 'proof_uploaded', // Status changes to indicate proof has been uploaded
      },
    })

    // Update the related transaction description
    await db.transaction.updateMany({
      where: { refId: depositId, type: 'deposit', status: 'pending' },
      data: { description: `Deposit via ${deposit.method} — bukti pembayaran diupload, menunggu verifikasi` },
    })

    logBusinessEvent({
      event: 'DEPOSIT_PROOF_UPLOADED',
      userId: authResult.user.id,
      details: { depositId, method: deposit.method, amount: Number(deposit.amount) },
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
    logger.error({ err: error }, 'POST /api/wallet/deposits/[id]/proof error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
