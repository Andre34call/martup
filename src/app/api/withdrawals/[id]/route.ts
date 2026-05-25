import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status, adminNote } = await request.json()

    if (!status) {
      return NextResponse.json(
        { error: 'Status wajib diisi' },
        { status: 400 }
      )
    }

    const withdrawal = await db.withdrawal.findUnique({ where: { id } })
    if (!withdrawal) {
      return NextResponse.json(
        { error: 'Penarikan dana tidak ditemukan' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = { status }
    if (adminNote) updateData.adminNote = adminNote
    if (status === 'approved' || status === 'processed') {
      updateData.processedAt = new Date()
    }

    const updated = await db.withdrawal.update({
      where: { id },
      data: updateData,
    })

    // If rejected, refund the amount to seller wallet
    if (status === 'rejected') {
      const wallet = await db.wallet.findUnique({
        where: { sellerId: withdrawal.sellerId },
      })
      if (wallet) {
        await db.wallet.update({
          where: { sellerId: withdrawal.sellerId },
          data: { balance: { increment: withdrawal.amount } },
        })

        await db.walletMutation.create({
          data: {
            walletId: wallet.id,
            type: 'credit',
            amount: withdrawal.amount,
            balance: wallet.balance + withdrawal.amount,
            description: `Pengembalian dana penarikan yang ditolak`,
            refType: 'withdraw',
            refId: withdrawal.id,
          },
        })
      }
    }

    return NextResponse.json({ withdrawal: updated })
  } catch (error) {
    console.error('Update withdrawal error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
