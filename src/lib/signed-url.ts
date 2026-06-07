import { logger } from '@/lib/logger'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Set of bucket names that are private and require signed URLs for access.
 * These buckets contain sensitive financial documents (payment proofs, deposit receipts).
 */
export const PRIVATE_BUCKETS = new Set(['payments', 'deposits'])

/**
 * Check if a bucket is private (requires signed URLs for access).
 */
export function isPrivateBucket(bucket: string): boolean {
  return PRIVATE_BUCKETS.has(bucket)
}

/**
 * Generate a signed URL for accessing a private object in Supabase Storage.
 * Uses the Supabase REST API with the service role key for server-side access.
 *
 * @param bucket - The bucket name (must be a private bucket)
 * @param path - The object path within the bucket (e.g., "folder/filename.jpg")
 * @param expiresIn - URL expiry time in seconds (default: 3600 = 1 hour)
 * @returns The signed URL string
 * @throws Error if Supabase is not configured or the API call fails
 */
export async function generateSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }

  if (!path) {
    throw new Error('Object path is required to generate a signed URL.')
  }

  // Validate expiresIn range (1 second to 24 hours)
  const safeExpiresIn = Math.max(1, Math.min(expiresIn, 86400))

  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: safeExpiresIn }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }))
      const errorMsg = errorData.message || errorData.error || 'Unknown error'
      logger.error(
        { bucket, path, status: response.status, error: errorMsg },
        'Failed to generate signed URL'
      )
      throw new Error(`Failed to generate signed URL: ${errorMsg}`)
    }

    const data = await response.json() as { signedURL?: string; signedUrl?: string }

    // Supabase may return either signedURL or signedUrl depending on version
    const signedUrl = data.signedURL || data.signedUrl

    if (!signedUrl) {
      logger.error({ bucket, path, data }, 'Signed URL not found in response')
      throw new Error('Signed URL not found in Supabase response')
    }

    // If the signed URL is relative, prepend the Supabase URL
    if (signedUrl.startsWith('/')) {
      return `${SUPABASE_URL}${signedUrl}`
    }

    return signedUrl
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Failed to generate signed URL')) {
      throw error
    }
    logger.error({ err: error, bucket, path }, 'Unexpected error generating signed URL')
    throw new Error('Unexpected error generating signed URL')
  }
}

/**
 * Generate multiple signed URLs for objects in the same bucket.
 * More efficient than calling generateSignedUrl in a loop when you need several URLs.
 *
 * @param bucket - The bucket name
 * @param paths - Array of object paths within the bucket
 * @param expiresIn - URL expiry time in seconds (default: 3600 = 1 hour)
 * @returns Array of { path, signedUrl } objects
 */
export async function generateSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn: number = 3600
): Promise<Array<{ path: string; signedUrl: string }>> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }

  if (!paths.length) return []

  const safeExpiresIn = Math.max(1, Math.min(expiresIn, 86400))

  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${bucket}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expiresIn: safeExpiresIn,
          paths,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }))
      const errorMsg = errorData.message || errorData.error || 'Unknown error'
      logger.error(
        { bucket, pathCount: paths.length, status: response.status, error: errorMsg },
        'Failed to generate signed URLs'
      )
      throw new Error(`Failed to generate signed URLs: ${errorMsg}`)
    }

    const data = await response.json() as Array<{ path?: string; signedURL?: string; signedUrl?: string; error?: string }>

    return data.map((item, index) => {
      const signedUrl = item.signedURL || item.signedUrl || ''
      const fullUrl = signedUrl.startsWith('/') ? `${SUPABASE_URL}${signedUrl}` : signedUrl
      return {
        path: item.path || paths[index] || '',
        signedUrl: fullUrl,
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Failed to generate signed URLs')) {
      throw error
    }
    logger.error({ err: error, bucket, pathCount: paths.length }, 'Unexpected error generating signed URLs')
    throw new Error('Unexpected error generating signed URLs')
  }
}
