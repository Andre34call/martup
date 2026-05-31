import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

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

// Map bucket to default size limit (streams uses video limit as max, but images get image limit)
const BUCKET_SIZE_MAP: Record<BucketId, number> = {
  products: UPLOAD_LIMITS.MAX_PRODUCT_IMAGE_SIZE_MB,
  avatars: UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB,
  banners: UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB,
  streams: UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB, // 50MB max for streams (video), images get 10MB
}

/**
 * POST /api/upload - Upload a file to Supabase Storage.
 * Requires authentication. Validates bucket, MIME type, and file size.
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

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
        { success: false, error: 'Bucket tidak valid. Hanya: products, avatars, banners, streams' },
        { status: 400 }
      )
    }

    const validBucket = bucket as BucketId

    // SECURITY: Validate MIME type
    const allAllowedTypes = [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES, ...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES]
    if (!allAllowedTypes.includes(file.type as any)) {
      return NextResponse.json(
        { success: false, error: `Tipe file tidak didukung: ${file.type}. Hanya gambar (JPEG, PNG, WebP, GIF) dan video (MP4, WebM, MOV)` },
        { status: 400 }
      )
    }

    // SECURITY: Validate file size
    // For streams bucket, use different limits based on file type
    let maxSizeMB = BUCKET_SIZE_MAP[validBucket]
    if (validBucket === 'streams') {
      const isVideo = UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES.includes(file.type as any)
      maxSizeMB = isVideo ? UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB : UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB
    }
    const maxSizeBytes = UPLOAD_LIMITS.mbToBytes(maxSizeMB)
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { success: false, error: `Ukuran file melebihi batas ${maxSizeMB}MB` },
        { status: 400 }
      )
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const filename = `${timestamp}_${randomSuffix}.${ext}`
    const filePath = folder ? `${folder}/${filename}` : filename

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
      // Provide more specific error messages for common issues
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
          { success: false, error: `Ukuran file melebihi batas upload.` },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { success: false, error: `Gagal mengupload file: ${error.message || 'Unknown error'}` },
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
