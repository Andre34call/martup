/**
 * Utility to convert Prisma Decimal fields to plain numbers for JSON serialization.
 * Prisma Decimal objects don't serialize to JSON properly and will cause issues
 * when returned from API routes.
 */

import { Prisma } from '@prisma/client'

/**
 * Convert a Prisma Decimal or null/undefined value to a number or null.
 */
export function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

/**
 * Convert a Prisma Decimal or null/undefined value to a number, with a default.
 */
export function decimalToNumberDefault(value: Prisma.Decimal | null | undefined, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue
  return Number(value)
}

/**
 * Recursively convert all Prisma Decimal values in an object to numbers.
 * This is useful for serializing entire Prisma results to JSON.
 */
export function serializeDecimal<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Prisma.Decimal) return Number(obj) as T
  if (Array.isArray(obj)) return obj.map(serializeDecimal) as T
  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDecimal(value)
    }
    return result as T
  }
  return obj
}
