import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

// GET /api/admin/users - Fetch all users with seller info, order count, total spent
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') // optional filter
    const search = searchParams.get('search') // optional search

    const where: Record<string, unknown> = {}

    if (role && role !== 'all') {
      where.role = role
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const users = await db.user.findMany({
      where,
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
        divisionId: user.divisionId,
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
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { userId, isVerified, isActive, role, updates } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}

    // Support both flat fields and updates object
    if (isVerified !== undefined) updateData.isVerified = isVerified
    if (isActive !== undefined) updateData.isActive = isActive

    // Handle isBlocked -> isActive mapping
    if (updates?.isBlocked !== undefined) {
      updateData.isActive = !updates.isBlocked
    }
    if (updates?.isVerified !== undefined) {
      updateData.isVerified = updates.isVerified
    }

    if (role !== undefined || updates?.role !== undefined) {
      const roleValue = role || updates?.role
      // Validate role value
      const validRoles = ['buyer', 'seller', 'admin', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr']
      if (!validRoles.includes(roleValue)) {
        return NextResponse.json(
          { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }
      // Prevent admin from removing their own admin role
      if (roleValue !== 'admin' && userId === authResult.user.id) {
        return NextResponse.json(
          { success: false, error: 'Cannot remove your own admin role' },
          { status: 400 }
        )
      }
      updateData.role = roleValue
    }

    // Support divisionId updates
    if (updates?.divisionId !== undefined) {
      updateData.divisionId = updates.divisionId
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
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    let userId: string | null = null

    // Support both query param and body
    const { searchParams } = new URL(request.url)
    userId = searchParams.get('userId')

    if (!userId) {
      try {
        const body = await request.json()
        userId = body.userId
      } catch {
        // No body or invalid JSON
      }
    }

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
