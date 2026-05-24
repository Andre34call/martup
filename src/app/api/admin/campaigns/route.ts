import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/campaigns - List all campaigns with seller info, support ?status=active filter
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    const campaigns = await db.campaign.findMany({
      where,
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            storeAvatar: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const now = new Date()
    const mapped = campaigns.map((c) => ({
      id: c.id,
      sellerId: c.sellerId,
      sellerStoreName: c.seller.storeName,
      sellerAvatar: c.seller.storeAvatar,
      sellerVerified: c.seller.isVerified,
      name: c.name,
      type: c.type,
      startDate: c.startDate,
      endDate: c.endDate,
      discount: c.discount,
      isActive: c.isActive,
      isExpired: c.endDate < now,
      isUpcoming: c.startDate > now,
      createdAt: c.createdAt,
    }))

    return NextResponse.json({ success: true, data: mapped })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin campaigns GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/campaigns - Update campaign (approve/reject)
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { campaignId, isActive, adminNote } = body

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: 'campaignId is required' },
        { status: 400 }
      )
    }

    if (isActive === undefined) {
      return NextResponse.json(
        { success: false, error: 'isActive is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { isActive }
    // Note: Campaign model doesn't have adminNote field, but we log it
    // If adminNote is needed, it can be added to the schema later

    const campaign = await db.campaign.update({
      where: { id: campaignId },
      data: updateData,
      include: {
        seller: {
          select: { storeName: true },
        },
      },
    })

    // Optionally create a notification for the seller about the campaign status
    if (campaign.sellerId) {
      const sellerUser = await db.user.findFirst({
        where: { seller: { id: campaign.sellerId } },
      })
      if (sellerUser) {
        await db.notification.create({
          data: {
            userId: sellerUser.id,
            title: isActive ? 'Kampanye Disetujui' : 'Kampanye Ditolak',
            content: isActive
              ? `Kampanye "${campaign.name}" telah disetujui dan aktif.`
              : `Kampanye "${campaign.name}" telah ditolak. ${adminNote ? `Alasan: ${adminNote}` : ''}`,
            type: 'system',
            refType: 'campaign',
            refId: campaign.id,
          },
        })
      }
    }

    return NextResponse.json({ success: true, data: campaign })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin campaigns PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
