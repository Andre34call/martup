import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

// GET /api/admin/divisions - Fetch all divisions with member counts
export async function GET(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const divisions = await db.division.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { members: true },
        },
        headUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    })

    const formattedDivisions = divisions.map((div) => ({
      id: div.id,
      name: div.name,
      slug: div.slug,
      description: div.description,
      icon: div.icon,
      color: div.color,
      headUserId: div.headUserId,
      headUser: div.headUser,
      memberCount: div._count.members,
      isActive: div.isActive,
      sortOrder: div.sortOrder,
      createdAt: div.createdAt,
      updatedAt: div.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      divisions: formattedDivisions,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Divisions GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/admin/divisions - Create a new division
export async function POST(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { name, slug, description, icon, color, headUserId, sortOrder } = body

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // Check for duplicate slug
    const existing = await db.division.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Division with slug "${slug}" already exists` },
        { status: 409 }
      )
    }

    const division = await db.division.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        color: color || null,
        headUserId: headUserId || null,
        sortOrder: sortOrder || 0,
      },
      include: {
        _count: { select: { members: true } },
        headUser: {
          select: { id: true, name: true, email: true, avatar: true, role: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      division: {
        id: division.id,
        name: division.name,
        slug: division.slug,
        description: division.description,
        icon: division.icon,
        color: division.color,
        headUserId: division.headUserId,
        headUser: division.headUser,
        memberCount: division._count.members,
        isActive: division.isActive,
        sortOrder: division.sortOrder,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Divisions POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/divisions - Update a division
export async function PATCH(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body = await request.json()
    const { divisionId, updates } = body

    if (!divisionId) {
      return NextResponse.json(
        { success: false, error: 'divisionId is required' },
        { status: 400 }
      )
    }

    const allowedFields = ['name', 'slug', 'description', 'icon', 'color', 'headUserId', 'isActive', 'sortOrder']
    const filteredUpdates: Record<string, unknown> = {}

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key]
      }
    }

    const division = await db.division.update({
      where: { id: divisionId },
      data: filteredUpdates,
      include: {
        _count: { select: { members: true } },
        headUser: {
          select: { id: true, name: true, email: true, avatar: true, role: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      division: {
        id: division.id,
        name: division.name,
        slug: division.slug,
        description: division.description,
        icon: division.icon,
        color: division.color,
        headUserId: division.headUserId,
        headUser: division.headUser,
        memberCount: division._count.members,
        isActive: division.isActive,
        sortOrder: division.sortOrder,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Divisions PATCH error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/divisions - Delete a division
export async function DELETE(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const divisionId = searchParams.get('divisionId')

    if (!divisionId) {
      return NextResponse.json(
        { success: false, error: 'divisionId is required' },
        { status: 400 }
      )
    }

    // Unassign all members first
    await db.user.updateMany({
      where: { divisionId },
      data: { divisionId: null },
    })

    // Delete the division
    await db.division.delete({ where: { id: divisionId } })

    return NextResponse.json({
      success: true,
      message: 'Division deleted successfully',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Divisions DELETE error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
