import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

import { logger } from '@/lib/logger'
export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const notification = await db.notification.findUnique({ where: { id } })
    if (!notification) {
      return NextResponse.json(
        { error: 'Notifikasi tidak ditemukan' },
        { status: 404 }
      )
    }

    await db.notification.update({
      where: { id },
      data: { isRead: true },
    })

    return NextResponse.json({ message: 'Notifikasi ditandai telah dibaca' })
  } catch (error) {
    logger.error({ err: error }, 'Mark notification read error')
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
