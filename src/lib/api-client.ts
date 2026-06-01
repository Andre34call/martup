/**
 * API Client - A comprehensive fetch wrapper for the MartUp e-commerce API.
 * Handles base URL, Authorization headers, CSRF protection with retry, JSON parsing, and error responses.
 *
 * Key features:
 * - Checks `authToken` localStorage key for auth
 * - Automatic CSRF token injection for mutating requests (POST, PUT, DELETE, PATCH)
 * - CSRF retry: if a 403 CSRF error occurs, fetches a fresh token and retries once
 * - Consistent error handling with ApiClientError
 * - Request timeout (15s default) to prevent infinite loading states
 */

import { getCsrfToken, ensureCsrfToken, fetchFreshCsrfToken } from '@/lib/csrf-client'

// Default timeout for API requests (15 seconds)
const API_TIMEOUT_MS = 15_000
// Longer timeout for file uploads (60 seconds)
const UPLOAD_TIMEOUT_MS = 60_000

/**
 * Fetch with AbortController timeout — prevents requests from hanging indefinitely.
 * On slow/unstable connections (especially mobile), a server that doesn't respond
 * will leave the UI stuck in a loading state forever without this.
 *
 * NOTE: Does NOT use AbortSignal.any() because it's not supported on older
 * mobile browsers (requires Chrome 116+, Safari 17.4+, Firefox 130+).
 */
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  return fetch(url, { ...options, signal: controller.signal })
    .catch((err) => {
      // Convert AbortError to a more descriptive error
      if (err.name === 'AbortError') {
        throw new DOMException('Request timed out', 'AbortError')
      }
      throw err
    })
    .finally(() => clearTimeout(timeoutId))
}

interface ApiError {
  error: string
  status: number
}

class ApiClientError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

/**
 * Get auth token for API requests.
 *
 * SECURITY: Primary auth is now via httpOnly session cookie — the browser sends it automatically.
 * The Bearer token from localStorage is retained ONLY as a fallback for backward compatibility
 * during the transition period. It should NOT be written to localStorage for new sessions.
 * New sessions use httpOnly cookies exclusively.
 */
function getToken(): string | null {
  if (typeof window === 'undefined') return null
  // Only read from localStorage for backward compatibility with existing sessions
  // New sessions should NOT store tokens in localStorage (XSS-vulnerable)
  return localStorage.getItem('authToken') || localStorage.getItem('martup_token')
}

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const url = new URL(path, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value)
      }
    })
  }
  return url.toString()
}

function getHeaders(includeCsrf: boolean = false): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // Add CSRF token for mutating requests (already URL-decoded by getCsrfToken)
  if (includeCsrf) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }
  }
  return headers
}

function getUploadHeaders(): HeadersInit {
  const headers: HeadersInit = {}
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken
  }
  return headers
}

/**
 * Fetch with CSRF retry — ensures a CSRF token is available before making
 * the request, and retries with a fresh token if CSRF validation fails.
 */
async function fetchWithCsrfRetry(url: string, options: RequestInit, timeoutMs: number = API_TIMEOUT_MS): Promise<Response> {
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
    (options.method || 'GET').toUpperCase()
  )

  // Auth routes that are CSRF-exempt (unauthenticated or have own auth)
  // Authenticated auth routes (change-password, logout, logout-all) REQUIRE CSRF
  const csrfExemptAuthRoutes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/auth/resend-verification',
    '/api/auth/otp/send',
    '/api/auth/otp/verify',
    '/api/auth/sync-user',
    '/api/auth/diagnostic',
    '/api/auth/login-diagnostic',
  ]
  const isAuthRoute = url.includes('/api/auth/')
  const isCsrfExemptAuthRoute = csrfExemptAuthRoutes.some(route => url.includes(route))
  if (isAuthRoute && isCsrfExemptAuthRoute) {
    return fetchWithTimeout(url, options, timeoutMs)
  }

  // For mutating requests, ensure we have a CSRF token before making the request
  if (isMutating) {
    const csrfToken = await ensureCsrfToken()
    if (csrfToken) {
      const existingHeaders = options.headers as Record<string, string> || {}
      options = {
        ...options,
        headers: {
          ...existingHeaders,
          'x-csrf-token': csrfToken,
        },
      }
    }
  }

  const response = await fetchWithTimeout(url, options, timeoutMs)

  // If CSRF validation failed, the server returns 403 with a fresh CSRF cookie
  // The server error message contains 'CSRF' and/or has code: 'CSRF_ERROR'
  if (response.status === 403 && isMutating) {
    const data = await response.clone().json().catch(() => null)
    const isCsrfError = data?.error?.toLowerCase().includes('csrf') ||
      data?.code === 'CSRF_ERROR' ||
      data?.error?.includes('Validasi keamanan') // Indonesian CSRF error message
    if (isCsrfError) {
      // Fetch a fresh CSRF token from the dedicated endpoint
      const freshToken = await fetchFreshCsrfToken()
      if (freshToken) {
        const existingHeaders = options.headers as Record<string, string> || {}
        const newHeaders = {
          ...existingHeaders,
          'x-csrf-token': freshToken,
        }
        return fetchWithTimeout(url, { ...options, headers: newHeaders }, timeoutMs)
      }
    }
  }

  return response
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = 'Terjadi kesalahan server'
    try {
      const data = await response.json()
      errorMessage = data.error || errorMessage
    } catch {
      // Use default error message
    }
    throw new ApiClientError(errorMessage, response.status)
  }
  return response.json() as Promise<T>
}

export const apiClient = {
  get: async <T>(url: string, params?: Record<string, string | undefined>): Promise<T> => {
    const fullUrl = buildUrl(url, params)
    const response = await fetchWithTimeout(fullUrl, {
      method: 'GET',
      headers: getHeaders(),
    })
    return handleResponse<T>(response)
  },

  post: async <T>(url: string, body?: unknown): Promise<T> => {
    const fullUrl = buildUrl(url)
    const response = await fetchWithCsrfRetry(fullUrl, {
      method: 'POST',
      headers: getHeaders(true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  put: async <T>(url: string, body?: unknown): Promise<T> => {
    const fullUrl = buildUrl(url)
    const response = await fetchWithCsrfRetry(fullUrl, {
      method: 'PUT',
      headers: getHeaders(true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  del: async <T>(url: string, body?: unknown): Promise<T> => {
    const fullUrl = buildUrl(url)
    const response = await fetchWithCsrfRetry(fullUrl, {
      method: 'DELETE',
      headers: getHeaders(true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  upload: async <T>(url: string, formData: FormData): Promise<T> => {
    const fullUrl = buildUrl(url)
    const response = await fetchWithCsrfRetry(fullUrl, {
      method: 'POST',
      headers: getUploadHeaders(),
      body: formData,
    }, UPLOAD_TIMEOUT_MS)
    return handleResponse<T>(response)
  },

  /**
   * Raw fetch with auth + CSRF + retry — returns the Response object directly.
   * Use this when you need to inspect the response status/body manually.
   */
  rawPost: async (url: string, body: unknown): Promise<Response> => {
    const fullUrl = buildUrl(url)
    return fetchWithCsrfRetry(fullUrl, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(body),
    })
  },

  patch: async <T>(url: string, body?: unknown): Promise<T> => {
    const fullUrl = buildUrl(url)
    const response = await fetchWithCsrfRetry(fullUrl, {
      method: 'PATCH',
      headers: getHeaders(true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  rawPatch: async (url: string, body: unknown): Promise<Response> => {
    const fullUrl = buildUrl(url)
    return fetchWithCsrfRetry(fullUrl, {
      method: 'PATCH',
      headers: getHeaders(true),
      body: JSON.stringify(body),
    })
  },

  rawPut: async (url: string, body: unknown): Promise<Response> => {
    const fullUrl = buildUrl(url)
    return fetchWithCsrfRetry(fullUrl, {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify(body),
    })
  },

  rawDelete: async (url: string, body?: unknown): Promise<Response> => {
    const fullUrl = buildUrl(url)
    return fetchWithCsrfRetry(fullUrl, {
      method: 'DELETE',
      headers: getHeaders(true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },
}

export { ApiClientError }
export type { ApiError }
