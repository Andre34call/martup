import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

import { logger } from '@/lib/logger'
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

    const product = await db.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json(
        { error: 'Produk tidak ditemukan' },
        { status: 404 }
      )
    }

    const updated = await db.product.update({
      where: { id },
      data: { status },
    })

    // Create notification for seller
    await db.notification.create({
      data: {
        userId: updated.sellerId,
        title: status === 'active' ? 'Produk Disetujui' : 'Produk Diblokir',
        content: status === 'active'
          ? `Produk "${updated.name}" telah disetujui dan aktif`
          : `Produk "${updated.name}" telah diblokir${adminNote ? `: ${adminNote}` : ''}`,
        type: 'system',
        refType: 'product',
        refId: updated.id,
      },
    })

    return NextResponse.json({
      product: {
        ...updated,
        images: updated.images ? JSON.parse(updated.images) : [],
        tags: updated.tags ? JSON.parse(updated.tags) : [],
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Approve/block product error')
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
