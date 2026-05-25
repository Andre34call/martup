import sanitizeHtml from 'sanitize-html'

/**
 * Sanitize user-generated content to prevent XSS attacks.
 * Strips all HTML tags and dangerous content while preserving plain text.
 */
export function sanitizeInput(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],          // Strip ALL HTML tags
    allowedAttributes: {},    // No attributes allowed
    disallowedTagsMode: 'discard',
    textFilter: (text) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
  }).trim()
}

/**
 * Sanitize content that allows basic formatting (bold, italic, links).
 * Use for product descriptions, etc.
 */
export function sanitizeRichContent(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {
      'a': ['href'],
    },
    allowedSchemes: ['https'],
  }).trim()
}

/**
 * Sanitize an object's string fields recursively.
 * Only sanitizes top-level string fields, does not recurse into nested objects.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): T {
  const sanitized = { ...obj }
  for (const field of fields) {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeInput(sanitized[field] as string) as T[keyof T]
    }
  }
  return sanitized
}
