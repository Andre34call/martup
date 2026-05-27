import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import { createWorkItemFromEntity } from '@/lib/workflow'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Require admin auth
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { id } = await params
    const { status, adminNote } = await request.json()

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status wajib diisi' },
        { status: 400 }
      )
    }

    const product = await db.product.findUnique({
      where: { id },
      include: { seller: { select: { userId: true, storeName: true } } },
    })
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 }
      )
    }

    const updated = await db.product.update({
      where: { id },
      data: { status },
    })

    // Create notification for seller
    if (product.seller?.userId) {
      await db.notification.create({
        data: {
          userId: product.seller.userId,
          title: status === 'active' ? 'Produk Disetujui' : 'Produk Diblokir',
          content: status === 'active'
            ? `Produk "${updated.name}" telah disetujui dan aktif`
            : `Produk "${updated.name}" telah diblokir${adminNote ? `: ${adminNote}` : ''}`,
          type: 'system',
          refType: 'product',
          refId: updated.id,
        },
      })
    }

    // Auto-create work item when product is blocked (product_report → Tech division)
    if (status === 'blocked') {
      await createWorkItemFromEntity({
        type: 'product_report',
        title: `Produk Diblokir: ${updated.name}`,
        description: `Produk "${updated.name}" dari ${product.seller?.storeName || 'Unknown'} telah diblokir oleh admin.${adminNote ? ` Catatan: ${adminNote}` : ''}`,
        refType: 'product',
        refId: updated.id,
        metadata: { productName: updated.name, sellerId: updated.sellerId, storeName: product.seller?.storeName, adminNote },
        priority: 'high',
        createdBy: authResult.user.id,
      }).catch(err => logger.warn({ err }, 'Failed to auto-create product report work item'))
    }

    return NextResponse.json({
      success: true,
      product: {
        ...updated,
        images: updated.images ? JSON.parse(updated.images) : [],
        tags: updated.tags ? JSON.parse(updated.tags) : [],
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Approve/block product error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
