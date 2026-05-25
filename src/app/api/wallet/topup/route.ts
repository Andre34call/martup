import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { userId, amount, method } = await request.json()

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'UserId dan jumlah top up wajib diisi' },
        { status: 400 }
      )
    }

    const wallet = await db.wallet.findUnique({ where: { userId } })

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet tidak ditemukan' },
        { status: 404 }
      )
    }

    // Add balance to wallet
    const updatedWallet = await db.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    })

    // Create mutation record
    await db.walletMutation.create({
      data: {
        walletId: wallet.id,
        type: 'credit',
        amount,
        balance: updatedWallet.balance,
        description: `Top up via ${method || 'unknown'}`,
        refType: 'deposit',
      },
    })

    // Create deposit record
    await db.deposit.create({
      data: {
        userId,
        amount,
        method: method || 'unknown',
        status: 'success',
      },
    })

    return NextResponse.json({
      wallet: {
        id: updatedWallet.id,
        balance: updatedWallet.balance,
        holdBalance: updatedWallet.holdBalance,
      },
      message: 'Top up berhasil',
    })
  } catch (error) {
    console.error('Top up error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
