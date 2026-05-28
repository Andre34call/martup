import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// Default user settings
const DEFAULT_USER_SETTINGS: Record<string, boolean> = {
  twoFactor: false,
  pushNotif: true,
  emailNotif: true,
  dataSharing: false,
}

const ALLOWED_KEYS = Object.keys(DEFAULT_USER_SETTINGS)

/**
 * Read user settings from DB and merge with defaults
 */
async function readUserSettings(userId: string): Promise<Record<string, boolean>> {
  try {
    const rows = await db.userSetting.findMany({
      where: { userId },
    })

    const saved: Record<string, string> = {}
    for (const row of rows) {
      saved[row.key] = row.value
    }

    // Merge defaults with saved values
    const merged: Record<string, boolean> = { ...DEFAULT_USER_SETTINGS }
    for (const key of ALLOWED_KEYS) {
      if (saved[key] !== undefined) {
        try {
          merged[key] = JSON.parse(saved[key]) as boolean
        } catch {
          // If JSON parse fails, keep the default
        }
      }
    }

    return merged
  } catch {
    return { ...DEFAULT_USER_SETTINGS }
  }
}

// GET /api/user/settings - Get the authenticated user's settings
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const settings = await readUserSettings(authResult.user.id)

    return NextResponse.json({ success: true, data: settings })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'User settings GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/user/settings - Update the authenticated user's settings
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()

    // Validate and collect updates
    const updates: Record<string, boolean> = {}
    for (const key of ALLOWED_KEYS) {
      if (body[key] !== undefined) {
        updates[key] = Boolean(body[key])
      }
    }

    if (Object.keys(updates).length === 0) {
      const settings = await readUserSettings(authResult.user.id)
      return NextResponse.json({ success: true, data: settings })
    }

    // Upsert each changed setting
    const userId = authResult.user.id
    await db.$transaction(
      Object.entries(updates).map(([key, value]) =>
        db.userSetting.upsert({
          where: { userId_key: { userId, key } },
          update: { value: JSON.stringify(value) },
          create: { userId, key, value: JSON.stringify(value) },
        })
      )
    )

    // Read back merged settings
    const settings = await readUserSettings(userId)

    return NextResponse.json({ success: true, data: settings })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'User settings PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
