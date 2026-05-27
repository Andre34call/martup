import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// ==================== WORK TYPE → DIVISION AUTO-ROUTING ====================

/**
 * Work type → division slug mapping for auto-routing.
 * When a new WorkItem is created without an explicit divisionId,
 * the system uses this mapping to determine which division should handle it.
 */
export const WORK_TYPE_TO_DIVISION: Record<string, string> = {
  complaint: 'cs',           // Complaints → Customer Service
  withdrawal: 'finance',     // Withdrawal requests → Finance
  deposit: 'finance',        // Deposit verifications → Finance
  refund: 'finance',         // Refund requests → Finance
  product_report: 'tech',    // Product reports (inappropriate content, bugs) → Tech/Bugs
  product_review: 'marketing', // Product review moderation → Marketing
  order_issue: 'operations', // Order problems (shipping, delivery) → Operations
  seller_verification: 'hr', // Seller verification → HR
  legal_issue: 'legal',      // Legal complaints → Legal
  custom: 'operations',      // Custom/other tasks → Operations (default)
}

// ==================== DISPLAY INFO ====================

/** Work type display info (Indonesian labels) */
export const WORK_TYPE_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
  complaint: { label: 'Keluhan', icon: '📢', color: 'orange' },
  withdrawal: { label: 'Penarikan Dana', icon: '💰', color: 'emerald' },
  deposit: { label: 'Deposit', icon: '💳', color: 'emerald' },
  refund: { label: 'Refund', icon: '↩️', color: 'red' },
  product_report: { label: 'Laporan Produk', icon: '🚨', color: 'purple' },
  product_review: { label: 'Review Produk', icon: '⭐', color: 'amber' },
  order_issue: { label: 'Masalah Pesanan', icon: '📦', color: 'blue' },
  seller_verification: { label: 'Verifikasi Seller', icon: '✅', color: 'teal' },
  legal_issue: { label: 'Isu Legal', icon: '⚖️', color: 'red' },
  custom: { label: 'Tugas Kustom', icon: '📋', color: 'gray' },
}

/** Priority display info */
export const WORK_PRIORITY_DISPLAY: Record<string, { label: string; color: string }> = {
  low: { label: 'Rendah', color: 'gray' },
  normal: { label: 'Normal', color: 'blue' },
  high: { label: 'Tinggi', color: 'orange' },
  urgent: { label: 'Urgent', color: 'red' },
}

/** Status display info */
export const WORK_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  open: { label: 'Terbuka', color: 'blue' },
  in_progress: { label: 'Dikerjakan', color: 'orange' },
  resolved: { label: 'Diselesaikan', color: 'emerald' },
  closed: { label: 'Ditutup', color: 'gray' },
  escalated: { label: 'Eskalasi', color: 'red' },
}

// ==================== VALID STATUS TRANSITIONS ====================

/**
 * Valid status transitions for WorkItems.
 * Controls the flow: open → in_progress → resolved/closed/escalated
 */
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed', 'escalated'],
  escalated: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
}

// ==================== HELPER: AUTO-CREATE WORK ITEM ====================

/**
 * Auto-create a WorkItem from an entity event (complaint, withdrawal, etc.).
 * Called by other API routes when new entities are created.
 *
 * @param params - Work item creation parameters
 * @returns The created WorkItem with division and assignee relations, or null on failure
 */
export async function createWorkItemFromEntity(params: {
  type: string
  title: string
  description?: string
  refType: string
  refId: string
  metadata?: Record<string, unknown>
  priority?: string
  createdBy?: string
}) {
  try {
    // 1. Determine division from type
    const divisionSlug = WORK_TYPE_TO_DIVISION[params.type] || 'operations'

    // 2. Find division by slug
    const division = await db.division.findUnique({
      where: { slug: divisionSlug },
    })

    if (!division) {
      logger.warn(
        { type: params.type, slug: divisionSlug },
        'Division not found for work item auto-routing'
      )
      return null
    }

    // 3. Create WorkItem
    const workItem = await db.workItem.create({
      data: {
        type: params.type,
        title: params.title,
        description: params.description || null,
        divisionId: division.id,
        refType: params.refType,
        refId: params.refId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        priority: params.priority || 'normal',
        createdBy: params.createdBy || 'system',
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

    logger.info(
      { workItemId: workItem.id, type: params.type, divisionId: division.id },
      'WorkItem auto-created'
    )
    return workItem
  } catch (error) {
    logger.error({ err: error, params }, 'Failed to auto-create work item')
    return null
  }
}
