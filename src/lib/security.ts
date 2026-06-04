// ==================== SECURITY UTILITIES ====================
// Input sanitization and security helpers for auth-related flows.

/**
 * Strip HTML tags from a string to prevent XSS injection.
 * Used primarily on free-text user inputs (name, storeName, etc.)
 * that may be interpolated into email templates or displayed to other users.
 *
 * This is a lightweight complement to the heavier `sanitizeInput` in `sanitize.ts`
 * which uses the `sanitize-html` library.  For most cases prefer `sanitizeInput`,
 * but this function is safe to call in Zod transforms and other contexts where
 * importing the full library is unnecessary.
 */
export function sanitizeHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}
