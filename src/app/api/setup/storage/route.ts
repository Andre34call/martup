import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

// ==================== CONFIG ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Required buckets with their configuration
const REQUIRED_BUCKETS = [
  { id: 'products', name: 'products', public: true, fileSizeLimit: 10 * 1024 * 1024 },
  { id: 'avatars', name: 'avatars', public: true, fileSizeLimit: 5 * 1024 * 1024 },
  { id: 'banners', name: 'banners', public: true, fileSizeLimit: 10 * 1024 * 1024 },
  { id: 'streams', name: 'streams', public: true, fileSizeLimit: 100 * 1024 * 1024 },
  { id: 'reviews', name: 'reviews', public: true, fileSizeLimit: 10 * 1024 * 1024 },
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

/** Create storage policy to allow public reads */
async function createPublicReadPolicy(bucketId: string): Promise<void> {
  // Create a policy that allows public access to read objects
  const policyName = `${bucketId}_public_read`
  const policySql = {
    sql: `
      CREATE POLICY "${policyName}" ON storage.objects
      FOR SELECT
      USING (bucket_id = '${bucketId}');
    `,
  }

  // We use the Supabase REST API for storage policies via the /rpc endpoint
  // But since we may not have pg_net enabled, we'll skip this for now.
  // Public buckets already allow public reads by default.
  logger.info({ bucketId }, 'Public read policy setup (bucket is already public)')
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
        results.push({ bucket: bucket.id, status: 'already_exists' })
        continue
      }

      const result = await createBucket(bucket)
      if (result.success) {
        await createPublicReadPolicy(bucket.id)
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
