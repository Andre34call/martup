// Shared auth header helper for API calls
// Includes CSRF token for mutating requests
// NOTE: Auth is primarily via httpOnly session cookie (sent automatically by browser).
// The Authorization header from localStorage is a secondary/fallback method.
import { getCsrfToken } from '@/lib/csrf-client'

export function getAuthHeaders(includeCsrf: boolean = false): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    // Try localStorage as fallback for Authorization header
    const token = localStorage.getItem('authToken')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    // Add CSRF token for mutating requests (POST, PUT, DELETE, PATCH)
    if (includeCsrf) {
      const csrfToken = getCsrfToken() // Already URL-decoded by getCsrfToken()
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken
      }
    }
  }
  return headers
}
