import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, verifySuperAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'

import { logger, logSecurityEvent } from '@/lib/logger'
import { validateCsrfRequest } from '@/lib/csrf'
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
  martupBankAccounts: '[]', // JSON string: [{ bankName, accountNumber, accountHolder }]
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

interface BankAccount {
  bankName: string
  accountNumber: string
  accountHolder: string
}

function parseBankAccounts(value: unknown): BankAccount[] {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch { /* ignore */ }
  }
  if (Array.isArray(value)) return value
  return []
}

async function readSettings(): Promise<Record<string, number | boolean | string>> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: SETTINGS_KEY } })
    if (row) {
      const saved = JSON.parse(row.value) as Record<string, number | boolean | string>
      // Parse martupBankAccounts from JSON string to array before merging
      const bankAccounts = parseBankAccounts(saved.martupBankAccounts)
      const result: Record<string, number | boolean | string> = { ...DEFAULT_SETTINGS }
      for (const [key, value] of Object.entries(saved)) {
        if (key === 'martupBankAccounts') {
          result[key] = JSON.stringify(bankAccounts)
        } else if (key in DEFAULT_SETTINGS) {
          result[key] = value
        }
      }
      return result
    }
  } catch {
    // If DB read fails or JSON is corrupted, return defaults
  }
  return { ...DEFAULT_SETTINGS }
}

// Helper to build the API response with martupBankAccounts as a proper array
function settingsToResponse(settings: Record<string, number | boolean | string>) {
  const { martupBankAccounts, ...rest } = settings
  return {
    ...rest,
    martupBankAccounts: parseBankAccounts(martupBankAccounts),
  }
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

    return NextResponse.json({ success: true, data: settingsToResponse(settings) })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin settings GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
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

    // SECURITY: CSRF protection
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json({ success: false, error: 'Keamanan request tidak valid. Refresh halaman dan coba lagi.' }, { status: 403 })
    }

    const body = await request.json()
    const current = await readSettings()

    // Only update fields that are provided and valid
    const allowedKeys = Object.keys(DEFAULT_SETTINGS)
    const updates: Record<string, number | boolean | string> = {}
    const validationErrors: string[] = []

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        // Validate martupBankAccounts (JSON array of bank account objects)
        if (key === 'martupBankAccounts') {
          const accounts = body[key]
          if (!Array.isArray(accounts)) {
            validationErrors.push('martupBankAccounts: must be an array')
            continue
          }
          // Validate each bank account object
          for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i]
            if (!acc || typeof acc !== 'object') {
              validationErrors.push(`martupBankAccounts[${i}]: must be an object`)
              continue
            }
            // Validate type field (bank or ewallet)
            const accType = acc.type === 'ewallet' ? 'ewallet' : 'bank'
            if (!acc.bankName || typeof acc.bankName !== 'string' || acc.bankName.trim().length === 0) {
              validationErrors.push(`martupBankAccounts[${i}].bankName: required`)
            }
            if (!acc.accountNumber || typeof acc.accountNumber !== 'string' || acc.accountNumber.trim().length === 0) {
              validationErrors.push(`martupBankAccounts[${i}].accountNumber: required`)
            }
            if (!acc.accountHolder || typeof acc.accountHolder !== 'string' || acc.accountHolder.trim().length === 0) {
              validationErrors.push(`martupBankAccounts[${i}].accountHolder: required`)
            }
            // Sanitize: only allow expected fields
            accounts[i] = {
              type: accType,
              bankName: String(acc.bankName || '').trim().slice(0, 50),
              accountNumber: String(acc.accountNumber || '').trim().slice(0, 30),
              accountHolder: String(acc.accountHolder || '').trim().slice(0, 100),
            }
          }
          if (validationErrors.length === 0) {
            updates[key] = JSON.stringify(accounts)
          }
          continue
        }
        // Validate numeric fields
        if (typeof DEFAULT_SETTINGS[key] === 'number') {
          // SECURITY: Use parseInt for integer fields, parseFloat only for commissionRate
          const isIntegerField = key !== 'commissionRate'
          const numVal = isIntegerField
            ? parseInt(String(body[key]), 10)
            : parseFloat(String(body[key]))
          if (isNaN(numVal)) {
            validationErrors.push(`${key}: must be a valid number`)
            continue
          }
          // Additional check: integer fields must not be fractional
          if (isIntegerField && numVal !== Math.floor(numVal)) {
            validationErrors.push(`${key}: must be a whole number`)
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

    return NextResponse.json({ success: true, data: settingsToResponse(merged) })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin settings PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
