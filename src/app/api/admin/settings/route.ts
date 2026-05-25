import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'

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
    console.error('Admin settings GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/settings - Update platform settings
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()
    const current = await readSettings()

    // Only update fields that are provided and valid
    const allowedKeys = Object.keys(DEFAULT_SETTINGS)
    const updates: Record<string, number | boolean | string> = {}

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        // Validate numeric fields
        if (typeof DEFAULT_SETTINGS[key] === 'number') {
          const numVal = parseFloat(String(body[key]))
          if (!isNaN(numVal)) {
            updates[key] = numVal
          }
        } else if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
          updates[key] = Boolean(body[key])
        } else {
          updates[key] = body[key]
        }
      }
    }

    const merged = { ...current, ...updates }
    await writeSettings(merged)

    return NextResponse.json({ success: true, data: merged })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin settings PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
