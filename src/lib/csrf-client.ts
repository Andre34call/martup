'use client'

// ==================== CSRF CLIENT UTILITY ====================
// Reads the CSRF token from cookie and attaches it to outgoing requests.
// Works with the server-side CSRF middleware in src/lib/csrf.ts
//
// IMPORTANT: The csrf-token cookie is set with httpOnly=false
// specifically so that JavaScript can read it for the double-submit pattern.

const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Get the CSRF token from the cookie.
 * The cookie is NOT httpOnly — it must be readable by JS for the double-submit pattern.
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null

  // Parse cookies properly — the token is base64-encoded and may contain =/+ chars
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=')
    if (name === CSRF_COOKIE_NAME) {
      return rest.join('=').trim() // Rejoin in case value contains '='
    }
  }
  return null
}

/**
 * Create fetch headers that include the CSRF token.
 * Use this for all mutating requests (POST, PUT, DELETE, PATCH).
 */
export function getCsrfHeaders(): Record<string, string> {
  const token = getCsrfToken()
  const headers: Record<string, string> = {}

  if (token) {
    headers[CSRF_HEADER_NAME] = token
  }

  return headers
}

/**
 * Enhanced fetch wrapper that automatically adds CSRF token for mutating requests.
 * Use this instead of raw fetch for all API calls.
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase()
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)

  if (isMutating) {
    const csrfHeaders = getCsrfHeaders()

    options.headers = {
      ...options.headers,
      ...csrfHeaders,
    }
  }

  const response = await fetch(url, options)

  // If CSRF validation failed (403), try to get a fresh token and retry once
  if (response.status === 403 && isMutating) {
    const data = await response.clone().json().catch(() => null)
    if (data?.error?.includes('CSRF')) {
      // The response should include a fresh CSRF cookie
      // Wait a tick for the cookie to be set, then retry
      await new Promise(resolve => setTimeout(resolve, 100))
      const newHeaders = getCsrfHeaders()

      options.headers = {
        ...options.headers,
        ...newHeaders,
      }

      return fetch(url, options)
    }
  }

  return response
}
