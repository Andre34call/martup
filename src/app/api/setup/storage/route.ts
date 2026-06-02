import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'

// ==================== CONFIG ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Required buckets with their configuration — sizes aligned with centralized UPLOAD_LIMITS
const REQUIRED_BUCKETS = [
  { id: 'products', name: 'products', public: true, fileSizeLimit: 50 * 1024 * 1024 },    // 50MB
  { id: 'avatars', name: 'avatars', public: true, fileSizeLimit: 10 * 1024 * 1024 },      // 10MB
  { id: 'banners', name: 'banners', public: true, fileSizeLimit: 10 * 1024 * 1024 },      // 10MB
  { id: 'streams', name: 'streams', public: true, fileSizeLimit: 100 * 1024 * 1024 },     // 100MB
  { id: 'reviews', name: 'reviews', public: true, fileSizeLimit: 50 * 1024 * 1024 },      // 50MB
]

// ==================== HELPER: Supabase Storage REST API ====================

async function supabaseHeaders(): Promise<Record<string, string>> {
  return {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'apikey': SUPABASE_SERVICE_ROLE_KEY!,
    'Content-Type': 'application/json',
  }
}

/** List all existing buckets */
async function listBuckets(): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    headers: await supabaseHeaders(),
  })
  if (!res.ok) {
    const err = await res.text()
    logger.error({ status: res.status, err }, 'Failed to list buckets')
    return []
  }
  const buckets: Array<{ id: string; name: string }> = await res.json()
  return buckets.map(b => b.id)
}

/** Create a single bucket */
async function createBucket(bucket: typeof REQUIRED_BUCKETS[number]): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: await supabaseHeaders(),
    body: JSON.stringify({
      id: bucket.id,
      name: bucket.name,
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit,
      allowedMimeTypes: bucket.id === 'avatars'
        ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        : bucket.id === 'streams'
          ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
          : ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
    }),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
    return { success: false, error: errData.message || errData.error || 'Unknown error' }
  }

  return { success: true }
}

/** Create RLS policies on storage.objects for a bucket to allow public reads and authenticated uploads */
async function createStoragePolicies(bucketId: string): Promise<void> {
  const policies = [
    {
      name: `${bucketId}_public_read`,
      sql: `CREATE POLICY IF NOT EXISTS "${bucketId}_public_read" ON storage.objects FOR SELECT USING (bucket_id = '${bucketId}')`,
    },
    {
      name: `${bucketId}_auth_upload`,
      sql: `CREATE POLICY IF NOT EXISTS "${bucketId}_auth_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
    },
    {
      name: `${bucketId}_auth_update`,
      sql: `CREATE POLICY IF NOT EXISTS "${bucketId}_auth_update" ON storage.objects FOR UPDATE USING (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
    },
    {
      name: `${bucketId}_auth_delete`,
      sql: `CREATE POLICY IF NOT EXISTS "${bucketId}_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
    },
  ]

  for (const policy of policies) {
    try {
      await db.$executeRawUnsafe(policy.sql)
      logger.info({ bucketId, policy: policy.name }, 'Created storage RLS policy')
    } catch (err) {
      // Policy might already exist or RLS may not be enabled yet — log but don't fail
      logger.warn({ bucketId, policy: policy.name, err }, 'RLS policy creation skipped (may already exist)')
    }
  }
}

// ==================== POST /api/setup/storage ====================
// Creates all required Supabase Storage buckets.
// Must be called by an authenticated admin or after initial setup.
// This endpoint is idempotent — safe to call multiple times.

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Validate Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('Supabase URL or Service Role Key not configured')
      return NextResponse.json(
        { success: false, error: 'Supabase belum dikonfigurasi. Set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      )
    }

    // Get existing buckets
    const existingBuckets = await listBuckets()
    logger.info({ existingBuckets }, 'Existing buckets')

    const results: Array<{ bucket: string; status: 'created' | 'already_exists' | 'error'; error?: string }> = []

    for (const bucket of REQUIRED_BUCKETS) {
      if (existingBuckets.includes(bucket.id)) {
        // Even if bucket exists, ensure RLS policies are in place
        await createStoragePolicies(bucket.id)
        results.push({ bucket: bucket.id, status: 'already_exists' })
        continue
      }

      const result = await createBucket(bucket)
      if (result.success) {
        await createStoragePolicies(bucket.id)
        results.push({ bucket: bucket.id, status: 'created' })
        logger.info({ bucket: bucket.id }, 'Bucket created successfully')
      } else {
        results.push({ bucket: bucket.id, status: 'error', error: result.error })
        logger.error({ bucket: bucket.id, error: result.error }, 'Failed to create bucket')
      }
    }

    const created = results.filter(r => r.status === 'created').length
    const existing = results.filter(r => r.status === 'already_exists').length
    const errors = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      success: errors === 0,
      message: `Setup selesai: ${created} bucket dibuat, ${existing} sudah ada, ${errors} error`,
      data: results,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Storage setup error')
    return NextResponse.json(
      { success: false, error: 'Gagal setup storage' },
      { status: 500 }
    )
  }
}

// ==================== GET /api/setup/storage ====================
// Check the status of required storage buckets

export async function GET(request: NextRequest) {
  try {
    // Validate Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'Supabase belum dikonfigurasi. Set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.',
      })
    }

    const existingBuckets = await listBuckets()

    const bucketStatus = REQUIRED_BUCKETS.map(bucket => ({
      id: bucket.id,
      exists: existingBuckets.includes(bucket.id),
    }))

    const missing = bucketStatus.filter(b => !b.exists)
    const allExist = missing.length === 0

    return NextResponse.json({
      success: true,
      configured: true,
      allBucketsExist: allExist,
      buckets: bucketStatus,
      missingBuckets: missing.map(b => b.id),
      message: allExist
        ? 'Semua storage bucket sudah tersedia'
        : `Bucket belum lengkap. Missing: ${missing.map(b => b.id).join(', ')}. Panggil POST /api/setup/storage untuk membuatnya.`,
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Storage check error')
    return NextResponse.json(
      { success: false, error: 'Gagal mengecek storage' },
      { status: 500 }
    )
  }
}
