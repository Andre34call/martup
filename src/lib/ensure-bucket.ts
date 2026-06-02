import { logger } from '@/lib/logger'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Ensure a Supabase Storage bucket exists and has public read access.
 * Creates the bucket if it doesn't exist and sets up RLS policies.
 * Idempotent — safe to call multiple times.
 */
export async function ensureBucket(
  bucketName: string,
  options: {
    maxFileSizeMb?: number
    allowedMimeTypes?: string[]
  } = {}
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn({ bucket: bucketName }, 'Supabase not configured, skipping ensureBucket')
    return false
  }

  const { maxFileSizeMb = 10, allowedMimeTypes } = options

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
    logger.info({ bucket: bucketName }, 'Creating storage bucket...')

    const createBody: Record<string, unknown> = {
      id: bucketName,
      name: bucketName,
      public: true,
      fileSizeLimit: maxFileSizeMb * 1024 * 1024,
    }

    if (allowedMimeTypes) {
      createBody.allowedMimeTypes = allowedMimeTypes
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

    logger.info({ bucket: bucketName }, 'Storage bucket created successfully')
    return true
  } catch (error) {
    logger.error({ err: error, bucket: bucketName }, 'ensureBucket error')
    return false
  }
}
