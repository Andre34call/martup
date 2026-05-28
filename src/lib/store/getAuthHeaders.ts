// Shared auth header helper for API calls
// Includes CSRF token for mutating requests
import { getCsrfToken } from '@/lib/csrf-client'

export function getAuthHeaders(includeCsrf: boolean = false): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
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
