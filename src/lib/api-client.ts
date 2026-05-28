/**
 * API Client - A comprehensive fetch wrapper for the MartUp e-commerce API.
 * Handles base URL, Authorization headers, CSRF protection with retry, JSON parsing, and error responses.
 *
 * Key features:
 * - Checks `authToken` localStorage key for auth
 * - Automatic CSRF token injection for mutating requests (POST, PUT, DELETE, PATCH)
 * - CSRF retry: if a 403 CSRF error occurs, fetches a fresh token and retries once
 * - Consistent error handling with ApiClientError
 */

import { getCsrfToken, ensureCsrfToken, fetchFreshCsrfToken } from '@/lib/csrf-client'

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
 * Get auth token from localStorage.
 */
function getToken(): string | null {
  if (typeof window === 'undefined') return null
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
async function fetchWithCsrfRetry(url: string, options: RequestInit): Promise<Response> {
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
    (options.method || 'GET').toUpperCase()
  )

  // Auth routes are CSRF-exempt — skip all CSRF handling to avoid
  // response body consumption issues on 403 (requiresVerification)
  const isAuthRoute = url.includes('/api/auth/')
  if (isAuthRoute) {
    return fetch(url, options)
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

  const response = await fetch(url, options)

  // If CSRF validation failed, the server returns 403 with a fresh CSRF cookie
  if (response.status === 403 && isMutating) {
    const data = await response.clone().json().catch(() => null)
    if (data?.error?.includes('CSRF') || data?.error?.includes('csrf')) {
      // Fetch a fresh CSRF token from the dedicated endpoint
      const freshToken = await fetchFreshCsrfToken()
      if (freshToken) {
        const existingHeaders = options.headers as Record<string, string> || {}
        const newHeaders = {
          ...existingHeaders,
          'x-csrf-token': freshToken,
        }
        return fetch(url, { ...options, headers: newHeaders })
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
    const response = await fetch(fullUrl, {
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
    })
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
