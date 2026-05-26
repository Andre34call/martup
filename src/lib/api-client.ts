/**
 * API Client - A simple fetch wrapper for the MartUp e-commerce API.
 * Handles base URL, Authorization headers, CSRF protection, JSON parsing, and error responses.
 */

import { getCsrfToken } from '@/lib/csrf-client'

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

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('martup_token')
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
  // Add CSRF token for mutating requests
  if (includeCsrf) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }
  }
  return headers
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
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: getHeaders(true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  put: async <T>(url: string, body?: unknown): Promise<T> => {
    const fullUrl = buildUrl(url)
    const response = await fetch(fullUrl, {
      method: 'PUT',
      headers: getHeaders(true),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },

  del: async <T>(url: string): Promise<T> => {
    const fullUrl = buildUrl(url)
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers: getHeaders(true),
    })
    return handleResponse<T>(response)
  },

  upload: async <T>(url: string, formData: FormData): Promise<T> => {
    const fullUrl = buildUrl(url)
    const token = getToken()
    const csrfToken = getCsrfToken()
    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: formData,
    })
    return handleResponse<T>(response)
  },
}

export { ApiClientError }
export type { ApiError }
