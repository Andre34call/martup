'use client'

// ==================== CSRF CLIENT UTILITY ====================
// Reads the CSRF token from cookie and attaches it to outgoing requests.
// Works with the server-side CSRF middleware in src/lib/csrf.ts

const CSRF_COOKIE_NAME = '__Host-csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Get the CSRF token from the cookie.
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null

  const match = document.cookie.match(new RegExp('(^| )' + CSRF_COOKIE_NAME + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
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
