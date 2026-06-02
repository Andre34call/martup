// ==================== SHARED JSON FIELD PARSERS ====================
// Replaces the duplicated `parseJsonField` functions found across many API routes.
// Use this as the single source of truth for safe JSON parsing.

/**
 * Safely parse a JSON string field (commonly stored in SQLite TEXT columns).
 *
 * Returns the parsed array, or an empty array if the value is null,
 * undefined, or not valid JSON.
 */
export function parseJsonField(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Generic version of parseJsonField that returns a typed array.
 */
export function parseJsonFieldAs<T>(value: string | null | undefined): T[] {
  if (!value) return [] as T[]
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : ([] as T[])
  } catch {
    return [] as T[]
  }
}

/**
 * Parse product JSON fields (images, tags) that are stored as JSON strings
 * in the database but need to be returned as arrays in API responses.
 */
export function parseProductJsonFields(product: Record<string, unknown>) {
  return {
    ...product,
    images: parseJsonField(product.images as string | null | undefined),
    tags: parseJsonField(product.tags as string | null | undefined),
  }
}
