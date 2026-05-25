export function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return 'h_' + Math.abs(hash).toString(36)
}

export function parseJsonField(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
    // If parsed to a non-array (e.g., a single string), wrap it
    if (typeof parsed === 'string') return [parsed]
    return []
  } catch {
    // Not valid JSON — try comma-separated string
    const trimmed = value.trim()
    if (trimmed.includes(',')) {
      return trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    }
    // Single URL string (not JSON)
    if (trimmed.startsWith('http') || trimmed.startsWith('/')) {
      return [trimmed]
    }
    return []
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function generateOrderNumber(): string {
  const now = new Date()
  const datePart = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0')
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ORD-${datePart}-${randomPart}`
}
