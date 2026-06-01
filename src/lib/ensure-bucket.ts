import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Bucket configurations with their max file sizes
const BUCKET_CONFIG = {
  products: { maxSize: 52428800 },   // 50MB
  avatars: { maxSize: 10485760 },    // 10MB
  banners: { maxSize: 10485760 },    // 10MB
  streams: { maxSize: 104857600 },   // 100MB
} as const

type BucketId = keyof typeof BUCKET_CONFIG

// Track which buckets we've already verified/created in this process
const verifiedBuckets = new Set<string>()

/**
 * Ensure a Supabase Storage bucket exists before uploading.
 * Checks if the bucket exists, and creates it if not.
 * Uses the database to check and create buckets with proper RLS policies.
 * Results are cached in-memory to avoid repeated checks.
 */
export async function ensureBucketExists(bucketId: string): Promise<void> {
  // Validate bucket ID
  if (!Object.keys(BUCKET_CONFIG).includes(bucketId)) {
    throw new Error(`Invalid bucket ID: ${bucketId}`)
  }

  // Skip if already verified in this process
  if (verifiedBuckets.has(bucketId)) {
    return
  }

  const config = BUCKET_CONFIG[bucketId as BucketId]

  try {
    // Check if bucket exists
    const bucket = await db.$queryRawUnsafe(
      `SELECT id FROM storage.buckets WHERE id = $1`,
      bucketId
    ) as { id: string }[]

    if (bucket.length === 0) {
      // Create the bucket
      await db.$executeRawUnsafe(
        `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
         VALUES ($1, $2, true, $3, NULL)
         ON CONFLICT (id) DO NOTHING`,
        bucketId, bucketId, config.maxSize
      )

      // Create basic RLS policies
      const policies = [
        `CREATE POLICY "${bucketId}_public_read" ON storage.objects
         FOR SELECT USING (bucket_id = '${bucketId}')`,
        `CREATE POLICY "${bucketId}_auth_upload" ON storage.objects
         FOR INSERT WITH CHECK (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
        `CREATE POLICY "${bucketId}_auth_update" ON storage.objects
         FOR UPDATE USING (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
        `CREATE POLICY "${bucketId}_auth_delete" ON storage.objects
         FOR DELETE USING (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
      ]

      for (const sql of policies) {
        try {
          await db.$executeRawUnsafe(sql)
        } catch {
          // Policy might already exist — ignore
        }
      }

      logger.info({ bucketId }, 'Auto-created storage bucket with policies')
    }

    // Mark as verified
    verifiedBuckets.add(bucketId)
  } catch (error) {
    logger.warn({ err: error, bucketId }, 'Failed to ensure bucket exists — proceeding with upload attempt')
    // Don't throw — let the upload attempt proceed; Supabase will return a proper error if bucket is truly missing
  }
}
