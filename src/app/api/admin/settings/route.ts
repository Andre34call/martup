import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, verifySuperAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'

import { logger, logSecurityEvent } from '@/lib/logger'
// Default platform settings
const DEFAULT_SETTINGS: Record<string, number | boolean | string> = {
  commissionRate: 5,       // percentage
  minWithdrawal: 50000,    // IDR
  platformFee: 1000,       // IDR per transaction
  maxProductImages: 10,
  maxProductVariants: 5,
  voucherEnabled: true,
  depositEnabled: true,
  campaignEnabled: true,
  chatEnabled: true,
  reviewEnabled: true,
  referralReward: 10000,   // IDR coins
  loyaltyPointsRate: 1,    // points per IDR 10000 spent
  flashSaleEnabled: true,
  autoConfirmDays: 3,      // auto-confirm delivery after N days
  returnWindowDays: 7,     // return window after delivery
}

// Validation rules for numeric settings
const VALIDATION_RULES: Record<string, { min: number; max: number; label: string }> = {
  commissionRate: { min: 0, max: 100, label: 'Commission Rate' },
  minWithdrawal: { min: 10000, max: Number.MAX_SAFE_INTEGER, label: 'Min Withdrawal' },
  platformFee: { min: 0, max: Number.MAX_SAFE_INTEGER, label: 'Platform Fee' },
  maxProductImages: { min: 1, max: 20, label: 'Max Product Images' },
  maxProductVariants: { min: 1, max: 10, label: 'Max Product Variants' },
  referralReward: { min: 0, max: Number.MAX_SAFE_INTEGER, label: 'Referral Reward' },
  loyaltyPointsRate: { min: 0, max: Number.MAX_SAFE_INTEGER, label: 'Loyalty Points Rate' },
  autoConfirmDays: { min: 1, max: 30, label: 'Auto Confirm Days' },
  returnWindowDays: { min: 1, max: 30, label: 'Return Window Days' },
}

const SETTINGS_KEY = 'platform_settings'

async function readSettings(): Promise<Record<string, number | boolean | string>> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: SETTINGS_KEY } })
    if (row) {
      const saved = JSON.parse(row.value) as Record<string, number | boolean | string>
      return { ...DEFAULT_SETTINGS, ...saved }
    }
  } catch {
    // If DB read fails or JSON is corrupted, return defaults
  }
  return { ...DEFAULT_SETTINGS }
}

async function writeSettings(settings: Record<string, number | boolean | string>): Promise<void> {
  const value = JSON.stringify(settings)
  await db.platformSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value },
    create: { key: SETTINGS_KEY, value },
  })
}

// GET /api/admin/settings - Get platform settings
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const settings = await readSettings()

    return NextResponse.json({ success: true, data: settings })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin settings GET error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/settings - Update platform settings
// SECURITY: Only Super Admin can change platform settings (commission rate, etc.)
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifySuperAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const current = await readSettings()

    // Only update fields that are provided and valid
    const allowedKeys = Object.keys(DEFAULT_SETTINGS)
    const updates: Record<string, number | boolean | string> = {}
    const validationErrors: string[] = []

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        // Validate numeric fields
        if (typeof DEFAULT_SETTINGS[key] === 'number') {
          const numVal = parseFloat(String(body[key]))
          if (isNaN(numVal)) {
            validationErrors.push(`${key}: must be a valid number`)
            continue
          }
          // Apply range validation rules
          const rule = VALIDATION_RULES[key]
          if (rule) {
            if (numVal < rule.min || numVal > rule.max) {
              const errorMsg = `${rule.label} must be between ${rule.min} and ${rule.max}`
              validationErrors.push(`${key}: ${errorMsg}`)
              logSecurityEvent({
                event: 'admin_settings_validation_failure',
                userId: authResult.user?.id,
                path: '/api/admin/settings',
                details: { key, value: numVal, min: rule.min, max: rule.max },
              })
              continue
            }
          }
          updates[key] = numVal
        } else if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
          updates[key] = Boolean(body[key])
        } else {
          updates[key] = body[key]
        }
      }
    }

    // Return 400 with all validation errors if any
    if (validationErrors.length > 0) {
      logger.warn({ validationErrors }, 'Admin settings validation failed')
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    const merged = { ...current, ...updates }
    await writeSettings(merged)

    return NextResponse.json({ success: true, data: merged })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Admin settings PUT error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
