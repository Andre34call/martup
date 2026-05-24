import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import fs from 'fs'
import path from 'path'

// Default platform settings
const DEFAULT_SETTINGS = {
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

type Settings = typeof DEFAULT_SETTINGS

const SETTINGS_FILE = path.join(process.cwd(), 'admin-settings.json')

function readSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8')
      const saved = JSON.parse(raw)
      return { ...DEFAULT_SETTINGS, ...saved }
    }
  } catch {
    // If file is corrupted, return defaults
  }
  return { ...DEFAULT_SETTINGS }
}

function writeSettings(settings: Settings): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
}

// GET /api/admin/settings - Get platform settings
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const settings = readSettings()

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
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const current = readSettings()

    // Only update fields that are provided and valid
    const allowedKeys = Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>
    const updates: Partial<Settings> = {}

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        // Validate numeric fields
        if (typeof DEFAULT_SETTINGS[key] === 'number') {
          const numVal = parseFloat(String(body[key]))
          if (!isNaN(numVal)) {
            (updates as Record<string, unknown>)[key] = numVal
          }
        } else if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
          (updates as Record<string, unknown>)[key] = Boolean(body[key])
        } else {
          (updates as Record<string, unknown>)[key] = body[key]
        }
      }
    }

    const merged = { ...current, ...updates }
    writeSettings(merged)

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
