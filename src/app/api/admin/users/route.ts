import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/users - Fetch all users with seller info, order count, total spent
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const users = await db.user.findMany({
      include: {
        seller: true,
        orders: {
          select: { totalAmount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const mapped = users.map((user) => {
      const totalSpent = user.orders.reduce(
        (sum, order) => sum + order.totalAmount,
        0
      )
      const totalOrders = user.orders.length

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        isBlocked: !user.isActive,
        joinDate: user.createdAt,
        totalSpent,
        totalOrders,
        seller: user.seller,
      }
    })

    return NextResponse.json({ success: true, data: mapped })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin users GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/users - Update user (verify, block, unblock, change role)
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { userId, isVerified, isActive, role } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (isVerified !== undefined) updateData.isVerified = isVerified
    if (isActive !== undefined) updateData.isActive = isActive
    if (role !== undefined) {
      // Validate role value
      const validRoles = ['buyer', 'seller', 'admin']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }
      // Prevent admin from removing their own admin role
      if (role !== 'admin' && userId === admin.id) {
        return NextResponse.json(
          { success: false, error: 'Cannot remove your own admin role' },
          { status: 400 }
        )
      }
      updateData.role = role
    }

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: user })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin users PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/users - Soft delete user (set isActive = false)
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true, data: user })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin users DELETE error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
