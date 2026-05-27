'use client'

// ==================== CSRF CLIENT UTILITY ====================
// Reads the CSRF token from cookie and attaches it to outgoing requests.
// Works with the server-side CSRF middleware in src/lib/csrf.ts
//
// IMPORTANT: The csrf-token cookie is set with httpOnly=false
// specifically so that JavaScript can read it for the double-submit pattern.
//
// FIX: Next.js URL-encodes cookie values when setting them (e.g., '=' → '%3D').
// When the client reads from document.cookie, it gets the URL-encoded value.
// But when the proxy reads via request.cookies.get(), Next.js URL-decodes it.
// This causes a mismatch in the double-submit comparison.
// Solution: URL-decode the cookie value on the client side before sending as header.

const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Get the CSRF token from the cookie, URL-decoded to match server-side parsing.
 * The cookie is NOT httpOnly — it must be readable by JS for the double-submit pattern.
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null

  // Parse cookies properly — the token is base64-encoded and may contain =/+ chars
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=')
    if (name === CSRF_COOKIE_NAME) {
      const rawValue = rest.join('=').trim() // Rejoin in case value contains '='
      // URL-decode to match server-side cookie parsing (Next.js URL-encodes on set,
      // URL-decodes on get). Without this, the double-submit comparison fails because
      // cookieToken (server-decoded) !== headerToken (raw from document.cookie).
      try {
        return decodeURIComponent(rawValue)
      } catch {
        // If decoding fails (malformed URI), return raw value as fallback
        return rawValue
      }
    }
  }
  return null
}

/**
 * Fetch a fresh CSRF token from the server.
 * This is used as a fallback when no CSRF cookie exists or the token is invalid.
 * The server sets a fresh cookie and returns the token in the response body.
 */
let csrfFetchPromise: Promise<string | null> | null = null

export async function fetchFreshCsrfToken(): Promise<string | null> {
  // Deduplicate concurrent fetches
  if (csrfFetchPromise) return csrfFetchPromise

  csrfFetchPromise = (async () => {
    try {
      const res = await fetch('/api/csrf-token', { method: 'GET' })
      if (!res.ok) return null

      // The cookie should now be set by the response
      // Wait a tick for the cookie to be available
      await new Promise(resolve => setTimeout(resolve, 50))

      // Read the token from the cookie (URL-decoded)
      return getCsrfToken()
    } catch {
      return null
    } finally {
      // Reset after a short delay to allow future fetches
      setTimeout(() => { csrfFetchPromise = null }, 1000)
    }
  })()

  return csrfFetchPromise
}

/**
 * Ensure a CSRF token is available, fetching a fresh one if needed.
 * Use this before making mutating requests to guarantee a valid token.
 */
export async function ensureCsrfToken(): Promise<string | null> {
  const existing = getCsrfToken()
  if (existing) return existing

  // No token available — fetch a fresh one
  return fetchFreshCsrfToken()
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
    // Ensure we have a CSRF token before making the request
    const token = await ensureCsrfToken()
    if (token) {
      options.headers = {
        ...options.headers,
        [CSRF_HEADER_NAME]: token,
      }
    }
  }

  const response = await fetch(url, options)

  // If CSRF validation failed (403), fetch a fresh token and retry once
  if (response.status === 403 && isMutating) {
    const data = await response.clone().json().catch(() => null)
    if (data?.error?.includes('CSRF') || data?.error?.includes('csrf')) {
      // Fetch a fresh CSRF token from the dedicated endpoint
      const freshToken = await fetchFreshCsrfToken()
      if (freshToken) {
        options.headers = {
          ...options.headers,
          [CSRF_HEADER_NAME]: freshToken,
        }

        return fetch(url, options)
      }
    }
  }

  return response
}
