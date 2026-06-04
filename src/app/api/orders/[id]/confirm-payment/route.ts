import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// POST /api/orders/[id]/confirm-payment — Buyer uploads payment proof for escrow orders
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { id: orderId } = await params
    const body = await request.json()
    const { proofUrl, bankName } = body

    if (!proofUrl || typeof proofUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Bukti pembayaran wajib diupload' },
        { status: 400 }
      )
    }

    if (!bankName || typeof bankName !== 'string' || bankName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nama bank pengirim wajib diisi' },
        { status: 400 }
      )
    }

    // Find the order
    const order = await db.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (order.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke pesanan ini' },
        { status: 403 }
      )
    }

    // Only escrow orders can upload payment proof
    if (!order.paymentMethod?.toLowerCase().includes('escrow')) {
      return NextResponse.json(
        { success: false, error: 'Metode pembayaran ini tidak memerlukan bukti transfer manual' },
        { status: 400 }
      )
    }

    // Only unpaid orders can upload proof
    if (order.paymentStatus !== 'unpaid') {
      return NextResponse.json(
        { success: false, error: `Status pembayaran saat ini: ${order.paymentStatus}. Tidak dapat upload bukti lagi.` },
        { status: 400 }
      )
    }

    // Update order with payment proof
    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        paymentProof: proofUrl.trim(),
        paymentBankName: bankName.trim().slice(0, 50),
        paymentStatus: 'pending_verification',
      },
    })

    logger.info({
      orderId,
      userId: authResult.user.id,
      bankName: bankName.trim(),
    }, 'Escrow payment proof uploaded')

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        paymentStatus: updated.paymentStatus,
        paymentProof: updated.paymentProof,
        paymentBankName: updated.paymentBankName,
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Confirm payment POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
