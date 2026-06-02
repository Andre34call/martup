import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, verifyManager, verifySuperAdmin, authErrorResponse, isSuperAdmin, isManager, ELEVATED_ROLES, MANAGER_ASSIGNABLE_ROLES, DIVISION_ROLES } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { env } from '@/lib/env'

import { logger } from '@/lib/logger'

// SECURITY: Super admin email — centralized from env.ts (no more hardcoded duplication)
const SUPER_ADMIN_EMAIL = env.SUPER_ADMIN_EMAIL

// Division role mapping — which role corresponds to which division slug
const DIVISION_SLUG_ROLE_MAP: Record<string, string> = {
  finance: 'finance',
  pr: 'pr',
  tech: 'tech',
  cs: 'cs',
  marketing: 'marketing',
  operations: 'operations',
  legal: 'legal',
  hr: 'hr',
}

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
        seller: {
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
            storeAvatar: true,
            storeBanner: true,
            isVerified: true,
            isPremium: true,
            rating: true,
            totalSales: true,
            totalProducts: true,
          },
        },
        _count: {
          select: { orders: true },
        },
        orders: {
          select: { totalAmount: true },
          where: { status: { notIn: ['CANCELLED', 'cancelled'] } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const mapped = users.map((user) => {
      const totalSpent = user.orders.reduce(
        (sum, order) => sum + Number(order.totalAmount),
        0
      )
      const totalOrders = user._count.orders

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

    // Determine user's permission level for frontend
    const isUserSuperAdmin = isSuperAdmin(authResult.user.role, authResult.user.email)
    const isUserManager = isManager(authResult.user.role)

    return NextResponse.json(serializeDecimal({
      success: true,
      data: mapped,
      // Permission flags — let frontend know what actions are available
      isSuperAdmin: isUserSuperAdmin,
      isManager: isUserSuperAdmin || isUserManager, // Super admin can also do manager things
    }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin users GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/users - Update user (verify, block, unblock, change role)
// Role changes follow the hierarchy:
// - Super Admin: can promote to any role including manager
// - Manager: can promote to admin/division roles, but NOT to manager
// - Regular Admin: can only verify/block/unblock, cannot change roles
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

    // Look up target user to check if they are super admin
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    })
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    // Determine current user's permission level
    const isCurrentUserSuperAdmin = isSuperAdmin(authResult.user.role, authResult.user.email)
    const isCurrentUserManager = isManager(authResult.user.role)

    // Protect super admin from being modified by anyone
    if (isSuperAdmin(targetUser.role, targetUser.email) && !isCurrentUserSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Super Admin tidak dapat diubah oleh admin lain' },
        { status: 403 }
      )
    }

    // Protect manager from being modified by non-super-admin
    if (isManager(targetUser.role) && !isCurrentUserSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Manager hanya dapat diubah oleh Super Admin' },
        { status: 403 }
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
      const validRoles = ['buyer', 'seller', 'admin', 'manager', ...DIVISION_ROLES]
      if (!validRoles.includes(roleValue)) {
        return NextResponse.json(
          { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }

      // HIERARCHY ENFORCEMENT: Role changes are restricted by permission level
      const isPromotingToElevated = (ELEVATED_ROLES as readonly string[]).includes(roleValue) && !(ELEVATED_ROLES as readonly string[]).includes(targetUser.role)
      const isPromotingToManager = roleValue === 'manager'

      if (isPromotingToElevated || isPromotingToManager) {
        // Only Super Admin can promote to Manager
        if (isPromotingToManager && !isCurrentUserSuperAdmin) {
          return NextResponse.json(
            { success: false, error: 'Hanya Super Admin yang dapat mempromosikan user ke role Manager' },
            { status: 403 }
          )
        }

        // Manager can promote to admin/division roles (but not manager)
        // Regular admin cannot promote at all
        if (isPromotingToElevated && !isPromotingToManager) {
          if (!isCurrentUserSuperAdmin && !isCurrentUserManager) {
            return NextResponse.json(
              { success: false, error: 'Hanya Manager atau Super Admin yang dapat mempromosikan user ke role admin atau divisi' },
              { status: 403 }
            )
          }
          // Manager cannot promote to manager (already handled above)
        }
      }

      // SECURITY: Nobody can promote to super admin (role='admin' + super admin email)
      if (roleValue === 'admin' && !isSuperAdmin(roleValue, targetUser.email)) {
        // Allow super admin/manager to promote to admin role, but this is NOT super admin
        // Super admin is identified by email, not just role
      }

      // Prevent admin from removing their own admin role
      if (roleValue !== 'admin' && roleValue !== 'manager' && userId === authResult.user.id) {
        return NextResponse.json(
          { success: false, error: 'Cannot remove your own admin role' },
          { status: 400 }
        )
      }
      updateData.role = roleValue
    }

    // Support divisionId updates — only manager/super admin can change
    if (updates?.divisionId !== undefined) {
      if (!isCurrentUserSuperAdmin && !isCurrentUserManager) {
        return NextResponse.json(
          { success: false, error: 'Hanya Manager atau Super Admin yang dapat mengubah divisi user' },
          { status: 403 }
        )
      }
      updateData.divisionId = updates.divisionId
    }

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isActive: true,
        avatar: true,
        divisionId: true,
        loyaltyPoints: true,
        coins: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(serializeDecimal({ success: true, data: user }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin users PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/users/promote - Manager/Super Admin promotes user to division admin
// This is the dedicated endpoint for promoting users to division-based roles
export async function PATCH(request: NextRequest) {
  // Manager or Super Admin can promote to division admin
  const authResult = await verifyManager(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { userId, divisionId, promoteToManager } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // Determine current user's permission level
    const isCurrentUserSuperAdmin = isSuperAdmin(authResult.user.role, authResult.user.email)

    // Only Super Admin can promote to Manager
    if (promoteToManager && !isCurrentUserSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Hanya Super Admin yang dapat mempromosikan user ke Manager' },
        { status: 403 }
      )
    }

    // Look up target user
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, name: true },
    })
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    // Cannot modify super admin
    if (isSuperAdmin(targetUser.role, targetUser.email)) {
      return NextResponse.json(
        { success: false, error: 'Super Admin tidak dapat diubah' },
        { status: 403 }
      )
    }

    // Cannot modify manager (only super admin can)
    if (isManager(targetUser.role) && !isCurrentUserSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Manager hanya dapat diubah oleh Super Admin' },
        { status: 403 }
      )
    }

    let newRole = ''
    let newDivisionId: string | null = divisionId || null

    if (promoteToManager) {
      // Promote to Manager role
      newRole = 'manager'
      newDivisionId = null // Managers are not tied to a specific division
    } else if (divisionId) {
      // Look up the division to determine the role
      const division = await db.division.findUnique({
        where: { id: divisionId },
        select: { id: true, slug: true, name: true },
      })
      if (!division) {
        return NextResponse.json(
          { success: false, error: 'Divisi tidak ditemukan' },
          { status: 404 }
        )
      }

      // Map division slug to role
      newRole = DIVISION_SLUG_ROLE_MAP[division.slug] || division.slug
      newDivisionId = division.id
    } else {
      // No division specified — promote to regular admin
      newRole = 'admin'
      newDivisionId = null
    }

    // Validate the role
    const validRoles = ['admin', 'manager', ...DIVISION_ROLES]
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { success: false, error: `Role "${newRole}" tidak valid untuk promosi` },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      role: newRole,
      divisionId: newDivisionId,
      isVerified: true, // Auto-verify promoted users
    }

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isActive: true,
        avatar: true,
        divisionId: true,
        loyaltyPoints: true,
        coins: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Create notification for the promoted user
    const divisionName = newDivisionId
      ? (await db.division.findUnique({ where: { id: newDivisionId }, select: { name: true } }))?.name || newRole
      : newRole === 'manager' ? 'Manager' : 'Admin'

    await db.notification.create({
      data: {
        userId: userId,
        title: 'Anda Dipromosikan',
        content: `Selamat! Anda telah dipromosikan menjadi ${divisionName}. Silakan login kembali untuk mengakses panel baru Anda.`,
        type: 'system',
      },
    })

    logger.info({ promotedUserId: userId, newRole, divisionId: newDivisionId, promotedBy: authResult.user.id }, 'User promoted by manager/super admin')

    return NextResponse.json(serializeDecimal({
      success: true,
      data: user,
      message: `${targetUser.name} telah dipromosikan ke ${divisionName}`,
    }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin users PATCH (promote) error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
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

    // Protect super admin from deletion
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    })

    if (targetUser && isSuperAdmin(targetUser.role, targetUser.email)) {
      return NextResponse.json(
        { success: false, error: 'Super Admin tidak dapat dihapus' },
        { status: 403 }
      )
    }

    // Only Super Admin can delete a Manager
    if (targetUser && isManager(targetUser.role) && !isSuperAdmin(authResult.user.role, authResult.user.email)) {
      return NextResponse.json(
        { success: false, error: 'Hanya Super Admin yang dapat menghapus Manager' },
        { status: 403 }
      )
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isActive: true,
        avatar: true,
        divisionId: true,
        loyaltyPoints: true,
        coins: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(serializeDecimal({ success: true, data: user }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin users DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
