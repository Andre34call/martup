import { logger } from '@/lib/logger'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Safe default MIME types that block dangerous types (e.g., HTML, SVG with JS, executables).
 * Only common image and video formats are allowed by default.
 */
const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]

/**
 * Ensure a Supabase Storage bucket exists.
 * Creates the bucket if it doesn't exist.
 * Idempotent — safe to call multiple times.
 *
 * @param bucketName - Name/ID of the bucket
 * @param options.public - Whether the bucket should be public (default: true for backward compatibility)
 * @param options.maxFileSizeMb - Max file size in MB (default: 10)
 * @param options.allowedMimeTypes - Allowed MIME types (default: safe list blocking dangerous types)
 */
export async function ensureBucket(
  bucketName: string,
  options: {
    public?: boolean
    maxFileSizeMb?: number
    allowedMimeTypes?: string[]
  } = {}
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn({ bucket: bucketName }, 'Supabase not configured, skipping ensureBucket')
    return false
  }

  const { public: isPublic = true, maxFileSizeMb = 10, allowedMimeTypes } = options

  try {
    // Check if bucket exists by trying to get it
    const getRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucketName}`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
    })

    if (getRes.ok) {
      logger.debug({ bucket: bucketName }, 'Bucket already exists')
      return true
    }

    if (getRes.status !== 404) {
      logger.warn({ bucket: bucketName, status: getRes.status }, 'Unexpected status checking bucket')
    }

    // Bucket doesn't exist — create it
    logger.info({ bucket: bucketName, public: isPublic }, 'Creating storage bucket...')

    const createBody: Record<string, unknown> = {
      id: bucketName,
      name: bucketName,
      public: isPublic,
      fileSizeLimit: maxFileSizeMb * 1024 * 1024,
      // Use provided allowedMimeTypes or fall back to safe defaults
      allowedMimeTypes: allowedMimeTypes || DEFAULT_ALLOWED_MIME_TYPES,
    }

    const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    })

    if (!createRes.ok && createRes.status !== 409) {
      const errText = await createRes.text().catch(() => 'unknown')
      logger.error({ bucket: bucketName, status: createRes.status, err: errText }, 'Failed to create bucket')
      return false
    }

    logger.info({ bucket: bucketName, public: isPublic }, 'Storage bucket created successfully')
    return true
  } catch (error) {
    logger.error({ err: error, bucket: bucketName }, 'ensureBucket error')
    return false
  }
}
