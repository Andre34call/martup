import { NextRequest, NextResponse } from 'next/server'
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf'

/**
 * GET /api/csrf-token
 * Issues a fresh CSRF token as a cookie and returns it in the response body.
 * The client can use this endpoint to obtain a valid CSRF token before making
 * mutating requests (POST, PUT, DELETE, PATCH).
 *
 * This endpoint is needed because:
 * 1. The CSRF cookie may not be set on the first page load (edge cases)
 * 2. The CSRF token may expire while the user is on the page
 * 3. The client needs a reliable way to obtain a fresh token
 */
export async function GET(request: NextRequest) {
  try {
    const token = await generateCsrfToken()

    const response = NextResponse.json({
      success: true,
      token,
    })

    // Set the CSRF cookie on the response
    setCsrfCookie(response, token)

    return response
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}
