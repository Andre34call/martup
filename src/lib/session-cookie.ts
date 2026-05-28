import { NextResponse } from 'next/server'

/**
 * Session Cookie Manager for Sticky Login
 *
 * Architecture:
 * - `martup_session`: httpOnly session cookie containing the HMAC auth token
 *   - httpOnly = XSS can't steal it
 *   - No Max-Age/Expires = session cookie → cleared when browser closes
 *   - SameSite=Lax = CSRF protection
 *
 * - `martup_auth`: Non-httpOnly flag cookie (value: "1")
 *   - JavaScript can check this to determine if user might be authenticated
 *   - Also a session cookie → cleared when browser closes
 *   - Used by DataFetcher to decide whether to attempt session recovery
 */

export const SESSION_COOKIE_NAME = 'martup_session'
export const AUTH_FLAG_COOKIE_NAME = 'martup_auth'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // Intentionally NO maxAge or expires → session cookie (cleared on browser close)
}

const FLAG_COOKIE_OPTIONS = {
  httpOnly: false, // Must be readable by JavaScript
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // Intentionally NO maxAge or expires → session cookie (cleared on browser close)
}

/**
 * Set both session cookies on a NextResponse.
 * Call this on every successful login/register/OTP-verify response.
 */
export function setSessionCookies(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS)
  response.cookies.set(AUTH_FLAG_COOKIE_NAME, '1', FLAG_COOKIE_OPTIONS)
  return response
}

/**
 * Clear both session cookies on a NextResponse.
 * Call this on logout.
 */
export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0, // Expire immediately
  })
  response.cookies.set(AUTH_FLAG_COOKIE_NAME, '', {
    ...FLAG_COOKIE_OPTIONS,
    maxAge: 0, // Expire immediately
  })
  return response
}

/**
 * Client-side helper: Check if the auth flag cookie exists.
 * Used by DataFetcher to decide whether to attempt session recovery.
 * Returns true if the martup_auth cookie is set (user might be authenticated).
 */
export function hasAuthFlagCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(c => c.trim().startsWith(`${AUTH_FLAG_COOKIE_NAME}=`))
}

/**
 * Client-side helper: Delete the auth flag cookie.
 * Used as a fallback when clearing cookies from the client side.
 */
export function deleteAuthFlagCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${AUTH_FLAG_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

/**
 * Client-side helper: Set the auth flag cookie (non-httpOnly).
 * Used as a fallback when the server didn't set it.
 */
export function setAuthFlagCookie(): void {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${AUTH_FLAG_COOKIE_NAME}=1; path=/; SameSite=Lax${secure}`
}
