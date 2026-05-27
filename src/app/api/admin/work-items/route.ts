import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, verifySuperAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'
import {
  WORK_TYPE_TO_DIVISION,
  VALID_STATUS_TRANSITIONS,
  createWorkItemFromEntity,
} from '@/lib/workflow'

// ==================== TYPES ====================

interface CreateWorkItemBody {
  type: string
  title: string
  description?: string
  priority?: string
  divisionId?: string
  assigneeId?: string
  refType?: string
  refId?: string
  metadata?: Record<string, unknown>
  dueDate?: string
}

interface UpdateWorkItemBody {
  workItemId: string
  status?: string
  assigneeId?: string
  priority?: string
  resolution?: string
  dueDate?: string
}

interface DeleteWorkItemBody {
  workItemId: string
}

// ==================== GET /api/admin/work-items ====================
// List work items with filters, pagination, and status counts

export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const { searchParams } = new URL(request.url)
    const divisionId = searchParams.get('divisionId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')
    const assigneeId = searchParams.get('assigneeId')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Build where clause from filters
    const where: Record<string, unknown> = {}
    if (divisionId) where.divisionId = divisionId
    if (status && status !== 'all') where.status = status
    if (type && type !== 'all') where.type = type
    if (priority && priority !== 'all') where.priority = priority
    if (assigneeId) where.assigneeId = assigneeId

    // Count per status (across all filtered items, ignoring status filter for counts)
    const countsWhere: Record<string, unknown> = { ...where }
    delete countsWhere.status

    const [open, in_progress, resolved, closed, escalated] = await Promise.all([
      db.workItem.count({ where: { ...countsWhere, status: 'open' } }),
      db.workItem.count({ where: { ...countsWhere, status: 'in_progress' } }),
      db.workItem.count({ where: { ...countsWhere, status: 'resolved' } }),
      db.workItem.count({ where: { ...countsWhere, status: 'closed' } }),
      db.workItem.count({ where: { ...countsWhere, status: 'escalated' } }),
    ])

    // Fetch paginated work items
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      db.workItem.findMany({
        where,
        include: {
          division: {
            select: { id: true, name: true, slug: true, icon: true, color: true },
          },
          assignee: {
            select: { id: true, name: true, avatar: true },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      db.workItem.count({ where }),
    ])

    // Parse metadata JSON strings and serialize decimals
    const data = items.map((item) => ({
      ...serializeDecimal(item),
      metadata: item.metadata ? JSON.parse(item.metadata as string) : null,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        open,
        in_progress,
        resolved,
        closed,
        escalated,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'WorkItems GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== POST /api/admin/work-items ====================
// Create a new work item (auto-routes to division based on type)

export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body: CreateWorkItemBody = await request.json()
    const {
      type,
      title,
      description,
      priority,
      divisionId: explicitDivisionId,
      assigneeId,
      refType,
      refId,
      metadata,
      dueDate,
    } = body

    // Validate required fields
    if (!type || !title) {
      return NextResponse.json(
        { success: false, error: 'type and title are required' },
        { status: 400 }
      )
    }

    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    const itemPriority = priority || 'normal'
    if (!validPriorities.includes(itemPriority)) {
      return NextResponse.json(
        { success: false, error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      )
    }

    // Determine divisionId: explicit > auto-routing
    let divisionId = explicitDivisionId || null

    if (!divisionId) {
      // Auto-route based on type
      const divisionSlug = WORK_TYPE_TO_DIVISION[type] || 'operations'
      const division = await db.division.findUnique({
        where: { slug: divisionSlug },
      })

      if (!division) {
        return NextResponse.json(
          {
            success: false,
            error: `Auto-routing failed: no division found with slug "${divisionSlug}" for type "${type}"`,
          },
          { status: 400 }
        )
      }

      divisionId = division.id
    }

    // Verify the division exists
    const divisionExists = await db.division.findUnique({
      where: { id: divisionId },
    })
    if (!divisionExists) {
      return NextResponse.json(
        { success: false, error: `Division with id "${divisionId}" not found` },
        { status: 400 }
      )
    }

    // Verify assignee exists if provided
    if (assigneeId) {
      const assignee = await db.user.findUnique({
        where: { id: assigneeId },
      })
      if (!assignee) {
        return NextResponse.json(
          { success: false, error: `Assignee with id "${assigneeId}" not found` },
          { status: 400 }
        )
      }
    }

    // Create the work item
    const workItem = await db.workItem.create({
      data: {
        type,
        title,
        description: description || null,
        status: 'open',
        priority: itemPriority,
        divisionId,
        assigneeId: assigneeId || null,
        refType: refType || null,
        refId: refId || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdBy: authResult.user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        division: {
          select: { id: true, name: true, slug: true, icon: true, color: true },
        },
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    // Create notification for assignee if assigned
    if (assigneeId) {
      await db.notification.create({
        data: {
          userId: assigneeId,
          title: 'Tugas Baru Ditugaskan',
          content: `Anda ditugaskan work item: "${title}"`,
          type: 'system',
          refType: 'work_item',
          refId: workItem.id,
        },
      }).catch((err) => {
        logger.warn({ err }, 'Failed to create assignment notification')
      })
    }

    logger.info(
      { workItemId: workItem.id, type, divisionId, createdBy: authResult.user.id },
      'WorkItem created'
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          ...serializeDecimal(workItem),
          metadata: workItem.metadata ? JSON.parse(workItem.metadata as string) : null,
        },
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'WorkItems POST error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== PATCH /api/admin/work-items ====================
// Update work item (status transitions, assignment, priority, resolution)

export async function PATCH(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const body: UpdateWorkItemBody = await request.json()
    const { workItemId, status, assigneeId, priority, resolution, dueDate } = body

    if (!workItemId) {
      return NextResponse.json(
        { success: false, error: 'workItemId is required' },
        { status: 400 }
      )
    }

    // Fetch current work item
    const current = await db.workItem.findUnique({
      where: { id: workItemId },
    })

    if (!current) {
      return NextResponse.json(
        { success: false, error: 'Work item not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    // Validate status transition
    if (status && status !== current.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[current.status]
      if (!allowedTransitions || !allowedTransitions.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status transition from "${current.status}" to "${status}". Allowed: [${allowedTransitions?.join(', ') || 'none'}]`,
          },
          { status: 400 }
        )
      }
      updateData.status = status

      // Set resolvedAt when status becomes resolved or closed
      if (status === 'resolved' || status === 'closed') {
        updateData.resolvedAt = new Date()
      }
    }

    // Validate priority if provided
    if (priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent']
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { success: false, error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.priority = priority
    }

    // Track assignee change for notification
    const isAssigneeChanged = assigneeId !== undefined && assigneeId !== current.assigneeId

    if (assigneeId !== undefined) {
      // Verify assignee exists (null means unassign)
      if (assigneeId !== null) {
        const assignee = await db.user.findUnique({
          where: { id: assigneeId },
        })
        if (!assignee) {
          return NextResponse.json(
            { success: false, error: `Assignee with id "${assigneeId}" not found` },
            { status: 400 }
          )
        }
      }
      updateData.assigneeId = assigneeId
    }

    // Resolution notes
    if (resolution !== undefined) {
      updateData.resolution = resolution
    }

    // Due date
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null
    }

    // If no updates provided
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No update fields provided' },
        { status: 400 }
      )
    }

    // Perform the update
    const updated = await db.workItem.update({
      where: { id: workItemId },
      data: updateData,
      include: {
        division: {
          select: { id: true, name: true, slug: true, icon: true, color: true },
        },
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    // Create notification for newly assigned user
    if (isAssigneeChanged && assigneeId) {
      await db.notification.create({
        data: {
          userId: assigneeId,
          title: 'Work Item Ditugaskan',
          content: `Anda ditugaskan work item: "${current.title}"`,
          type: 'system',
          refType: 'work_item',
          refId: workItemId,
        },
      }).catch((err) => {
        logger.warn({ err }, 'Failed to create assignment notification')
      })
    }

    logger.info(
      {
        workItemId,
        updates: updateData,
        updatedBy: authResult.user.id,
      },
      'WorkItem updated'
    )

    return NextResponse.json({
      success: true,
      data: {
        ...serializeDecimal(updated),
        metadata: updated.metadata ? JSON.parse(updated.metadata as string) : null,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'WorkItems PATCH error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== DELETE /api/admin/work-items ====================
// Delete a work item (admin or super admin only)

export async function DELETE(request: NextRequest) {
  // Require at least admin, prefer super admin
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    let body: DeleteWorkItemBody

    // DELETE can have body, but some clients send query params
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      body = await request.json()
    } else {
      const { searchParams } = new URL(request.url)
      const workItemId = searchParams.get('workItemId')
      body = { workItemId: workItemId! }
    }

    const { workItemId } = body

    if (!workItemId) {
      return NextResponse.json(
        { success: false, error: 'workItemId is required' },
        { status: 400 }
      )
    }

    // Verify work item exists
    const existing = await db.workItem.findUnique({
      where: { id: workItemId },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Work item not found' },
        { status: 404 }
      )
    }

    // Non-super-admins can only delete items in certain states
    if (authResult.user.role === 'admin' && authResult.user.email !== 'kholisakm@gmail.com') {
      // Verify super admin for hard-delete of open/in_progress items
      const superAdminResult = await verifySuperAdmin(request)
      if (!superAdminResult.success && (existing.status === 'open' || existing.status === 'in_progress')) {
        return NextResponse.json(
          { success: false, error: 'Only Super Admin can delete open or in-progress work items' },
          { status: 403 }
        )
      }
    }

    // Delete the work item
    await db.workItem.delete({
      where: { id: workItemId },
    })

    logger.info(
      {
        workItemId,
        deletedBy: authResult.user.id,
        previousStatus: existing.status,
      },
      'WorkItem deleted'
    )

    return NextResponse.json({
      success: true,
      message: 'Work item deleted successfully',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'WorkItems DELETE error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== RE-EXPORT HELPER ====================
// Re-export createWorkItemFromEntity so other routes can import from this path
export { createWorkItemFromEntity }
