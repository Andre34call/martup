import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

/**
 * Create a Supabase admin client with the service role key.
 * This bypasses RLS for server-side uploads (authenticated API route).
 * Falls back to the anon-key client if service role key is not available.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey) {
    return createClient(url, serviceRoleKey, {
      auth: { detectSessionInUrl: false, autoRefreshToken: false, persistSession: false },
    })
  }
  // Fallback to anon-key client (RLS applies) — log a warning
  logger.warn('SUPABASE_SERVICE_ROLE_KEY not set — using anon key for upload (RLS applies)')
  return supabase
}

// SECURITY: Only these buckets are allowed
const ALLOWED_BUCKETS = ['products', 'avatars', 'banners', 'streams'] as const
type BucketId = typeof ALLOWED_BUCKETS[number]

// SECURITY: Only these folder names are allowed (prevents path traversal)
const ALLOWED_FOLDERS: Record<BucketId, string[]> = {
  products: ['images', 'reviews'],
  avatars: ['profile', ''],
  banners: ['home', 'promo', ''],
  streams: ['images', 'videos', ''],
}

// Map bucket to default size limit (streams uses video limit as max, but images get image limit)
const BUCKET_SIZE_MAP: Record<BucketId, number> = {
  products: UPLOAD_LIMITS.MAX_PRODUCT_IMAGE_SIZE_MB,
  avatars: UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB,
  banners: UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB,
  streams: UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB, // 50MB max for streams (video), images get 10MB
}

// Rate limiter: 20 uploads per minute per user
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'rl:upload:',
})

/**
 * POST /api/upload - Upload a file to Supabase Storage.
 * Requires authentication. Validates bucket, folder, MIME type, and file size.
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // SECURITY: Rate limit uploads — 20 per minute per user
    const rateLimitResult = await uploadLimiter.check(authResult.user.id)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak upload. Coba lagi dalam beberapa menit.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.total),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetAt / 1000)),
          },
        }
      )
    }

    // Additional burst protection
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(`upload-burst:${authResult.user.id}:${clientIp}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    // Check Supabase is configured
    if (!isSupabaseConfigured()) {
      logger.error('Supabase not configured for file upload')
      return NextResponse.json(
        { success: false, error: 'Layanan upload belum dikonfigurasi' },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = formData.get('bucket') as string | null
    const folder = formData.get('folder') as string | null

    // Validate file exists
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File tidak ditemukan' },
        { status: 400 }
      )
    }

    // SECURITY: Validate bucket against allowlist
    if (!bucket || !ALLOWED_BUCKETS.includes(bucket as BucketId)) {
      return NextResponse.json(
        { success: false, error: 'Bucket tidak valid' },
        { status: 400 }
      )
    }

    const validBucket = bucket as BucketId

    // SECURITY: Validate folder against allowlist (prevents path traversal)
    const folderStr = folder || ''
    const allowedFolders = ALLOWED_FOLDERS[validBucket]
    if (!allowedFolders.includes(folderStr)) {
      return NextResponse.json(
        { success: false, error: 'Folder tidak valid' },
        { status: 400 }
      )
    }

    // SECURITY: Validate MIME type
    const allAllowedTypes = [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES, ...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES]
    if (!allAllowedTypes.includes(file.type as typeof allAllowedTypes[number])) {
      return NextResponse.json(
        { success: false, error: `Tipe file tidak didukung: ${file.type}` },
        { status: 400 }
      )
    }

    // SECURITY: Validate file size
    // For streams bucket, use different limits based on file type
    let maxSizeMB = BUCKET_SIZE_MAP[validBucket]
    if (validBucket === 'streams') {
      const isVideo = UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES.includes(file.type as typeof UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES[number])
      maxSizeMB = isVideo ? UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB : UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB
    }
    const maxSizeBytes = UPLOAD_LIMITS.mbToBytes(maxSizeMB)
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { success: false, error: `Ukuran file melebihi batas ${maxSizeMB}MB` },
        { status: 400 }
      )
    }

    // SECURITY: Use crypto.randomBytes for filename generation (not Math.random)
    // Validate file extension against allowlist
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov']
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { success: false, error: 'Ekstensi file tidak didukung' },
        { status: 400 }
      )
    }

    const randomSuffix = crypto.randomBytes(4).toString('hex')
    const filename = `${Date.now()}_${randomSuffix}.${ext}`
    const filePath = folderStr ? `${folderStr}/${filename}` : filename

    // Upload to Supabase Storage using service role key (bypasses RLS for server-side uploads)
    const adminClient = getAdminClient()

    const { data, error } = await adminClient.storage
      .from(validBucket)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      logger.error({ err: error, bucket: validBucket, path: filePath, errorMsg: error.message, errorCode: error.statusCode }, 'Supabase upload error')
      // Provide specific but safe error messages
      if (error.message?.includes('not found') || error.statusCode === '404') {
        return NextResponse.json(
          { success: false, error: `Bucket "${validBucket}" belum dikonfigurasi. Hubungi admin.` },
          { status: 500 }
        )
      }
      if (error.message?.includes('policy') || error.message?.includes('permission') || error.statusCode === '403') {
        return NextResponse.json(
          { success: false, error: 'Izin upload ditolak. Coba lagi nanti.' },
          { status: 500 }
        )
      }
      if (error.message?.includes('size') || error.message?.includes('limit') || error.message?.includes('too large')) {
        return NextResponse.json(
          { success: false, error: 'Ukuran file melebihi batas upload.' },
          { status: 400 }
        )
      }
      // Generic error in production, specific in development
      const errorMsg = process.env.NODE_ENV === 'development'
        ? `Gagal mengupload file: ${error.message}`
        : 'Gagal mengupload file. Coba lagi nanti.'
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = adminClient.storage
      .from(validBucket)
      .getPublicUrl(data.path)

    return NextResponse.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: data.path,
        type: validBucket === 'avatars' ? 'avatar' : validBucket === 'banners' ? 'banner' : validBucket === 'streams' ? 'stream' : 'product',
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Upload POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server saat upload' },
      { status: 500 }
    )
  }
}
