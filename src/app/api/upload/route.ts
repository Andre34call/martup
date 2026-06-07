import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'
import { ensureBucket } from '@/lib/ensure-bucket'
import { isPrivateBucket } from '@/lib/signed-url'
import { logger } from '@/lib/logger'

// ==================== CONFIG ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Rate limiter: 20 uploads per minute per user
const uploadLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  keyPrefix: 'rl:user:upload:',
})

// Allowed buckets whitelist — prevents arbitrary bucket access
const ALLOWED_BUCKETS = ['products', 'avatars', 'banners', 'streams', 'reviews', 'deposits', 'payments'] as const
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number]

// Buckets that are restricted to image-only uploads (sensitive financial documents)
const IMAGE_ONLY_BUCKETS: ReadonlySet<string> = new Set(['payments', 'deposits'])

// Safe file extensions mapped by type
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov']

// All allowed extensions combined
const ALL_ALLOWED_EXTENSIONS = [...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_VIDEO_EXTENSIONS]

// Default values
const DEFAULT_BUCKET = 'products'
const DEFAULT_FOLDER = 'images'

// Max file size per bucket type (in bytes)
function getMaxFileSize(bucket: string, fileType: 'image' | 'video'): number {
  switch (bucket as AllowedBucket) {
    case 'avatars':
      return UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB)
    case 'products':
      return fileType === 'video'
        ? UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB)
        : UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_PRODUCT_IMAGE_SIZE_MB)
    case 'reviews':
      return fileType === 'video'
        ? UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_REVIEW_VIDEO_SIZE_MB)
        : UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_REVIEW_IMAGE_SIZE_MB)
    case 'streams':
      return fileType === 'video'
        ? UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_STREAM_VIDEO_SIZE_MB)
        : UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_STREAM_IMAGE_SIZE_MB)
    case 'banners':
      return UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB)
    case 'payments':
    case 'deposits':
      // Image-only buckets
      return UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB)
    default:
      return fileType === 'video'
        ? UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB)
        : UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB)
  }
}

// Bucket-specific allowed MIME types for ensureBucket
function getBucketMimeTypes(bucket: string): string[] | undefined {
  if (IMAGE_ONLY_BUCKETS.has(bucket)) {
    return [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES]
  }
  // For other buckets, allow both images and videos
  return [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES, ...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES]
}

// Bucket-specific max file size for ensureBucket (largest allowed)
function getBucketMaxFileSizeMb(bucket: string): number {
  switch (bucket as AllowedBucket) {
    case 'avatars':
      return UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB
    case 'products':
      return Math.max(UPLOAD_LIMITS.MAX_PRODUCT_IMAGE_SIZE_MB, UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB)
    case 'reviews':
      return Math.max(UPLOAD_LIMITS.MAX_REVIEW_IMAGE_SIZE_MB, UPLOAD_LIMITS.MAX_REVIEW_VIDEO_SIZE_MB)
    case 'streams':
      return Math.max(UPLOAD_LIMITS.MAX_STREAM_IMAGE_SIZE_MB, UPLOAD_LIMITS.MAX_STREAM_VIDEO_SIZE_MB)
    case 'banners':
      return UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB
    case 'payments':
    case 'deposits':
      return UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB
    default:
      return UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB
  }
}

// ==================== MAGIC BYTE VALIDATION ====================

/**
 * Validate that an ArrayBuffer contains a real image by checking magic bytes (file signatures).
 * Prevents malicious files with spoofed extensions from being uploaded.
 */
function validateImageMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 4) return false

  // JPEG: starts with FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true

  // PNG: starts with 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true

  // GIF: starts with 47 49 46 38 (GIF8)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true

  // WebP: starts with 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true

  return false
}

/**
 * Validate that an ArrayBuffer contains a real video by checking magic bytes.
 * Less strict than image validation since video containers vary widely.
 */
function validateVideoMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 8) return false

  // MP4: check for 'ftyp' box at offset 4 (e.g., 00 00 00 20 66 74 79 70)
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return true

  // WebM: starts with 1A 45 DF A3 (EBML header)
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return true

  // MOV/QuickTime: starts with 'moov' or 'mdat' or free offset with 'mdat'/'moov'
  // Common: 00 00 00 14 6D 6F 6F 76 (....moov) or starts with mdat
  if (bytes[4] === 0x6D && bytes[5] === 0x6F && bytes[6] === 0x6F && bytes[7] === 0x76) return true // moov
  if (bytes[4] === 0x6D && bytes[5] === 0x64 && bytes[6] === 0x61 && bytes[7] === 0x74) return true // mdat

  return false
}

// ==================== DETERMINE FILE TYPE ====================

function determineFileType(mimeType: string): 'image' | 'video' | null {
  if ((UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType)) return 'image'
  if ((UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES as readonly string[]).includes(mimeType)) return 'video'
  return null
}

// ==================== UPLOAD TO SUPABASE ====================

async function uploadToSupabase(
  bucket: string,
  filePath: string,
  fileBuffer: ArrayBuffer,
  contentType: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, status: 500, error: 'Storage not configured' }
  }

  const uploadResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': contentType,
      },
      body: fileBuffer,
    }
  )

  if (!uploadResponse.ok) {
    let errorData: { message?: string; error?: string; statusCode?: string }
    try {
      errorData = await uploadResponse.json()
    } catch {
      errorData = { message: `HTTP ${uploadResponse.status}` }
    }
    const errorMsg = errorData.message || errorData.error || 'Unknown error'
    return { ok: false, status: uploadResponse.status, error: errorMsg }
  }

  return { ok: true, status: uploadResponse.status }
}

// ==================== POST /api/upload ====================

export async function POST(request: NextRequest) {
  try {
    // 1. Auth required
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // 2. Rate limit: 20 uploads per minute per user
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await uploadLimiter.check(`${clientIp}:${authResult.user.id}`)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    // 3. Validate Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Storage not configured. Contact admin.' },
        { status: 500 }
      )
    }

    // 4. Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = (formData.get('bucket') as string | null) || DEFAULT_BUCKET
    const folder = (formData.get('folder') as string | null) || DEFAULT_FOLDER

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // 5. Validate bucket against whitelist
    if (!ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
      return NextResponse.json(
        { success: false, error: `Invalid bucket. Allowed buckets: ${ALLOWED_BUCKETS.join(', ')}` },
        { status: 400 }
      )
    }

    // 6. Determine and validate file type
    const fileType = determineFileType(file.type)

    if (!fileType) {
      const allowed = IMAGE_ONLY_BUCKETS.has(bucket)
        ? UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES.join(', ')
        : [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES, ...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES].join(', ')
      return NextResponse.json(
        { success: false, error: `Invalid file type. Allowed: ${allowed}. Got: ${file.type || 'unknown'}` },
        { status: 400 }
      )
    }

    // 7. Restrict payments/deposits buckets to image-only
    if (IMAGE_ONLY_BUCKETS.has(bucket) && fileType !== 'image') {
      return NextResponse.json(
        { success: false, error: `Bucket "${bucket}" only accepts image files. Got: ${file.type}` },
        { status: 400 }
      )
    }

    // 8. Validate file size based on bucket and file type
    const maxFileSize = getMaxFileSize(bucket, fileType)
    if (file.size > maxFileSize) {
      const maxMB = Math.round(maxFileSize / (1024 * 1024))
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size for ${fileType}s in bucket "${bucket}" is ${maxMB}MB.` },
        { status: 400 }
      )
    }

    // 9. Sanitize file extension (prevent path traversal / dangerous extensions)
    const rawExt = file.name.split('.').pop() || ''
    const lowerExt = rawExt.toLowerCase()
    let ext: string

    if (fileType === 'image' && ALLOWED_IMAGE_EXTENSIONS.includes(lowerExt)) {
      ext = lowerExt
    } else if (fileType === 'video' && ALLOWED_VIDEO_EXTENSIONS.includes(lowerExt)) {
      ext = lowerExt
    } else if (ALL_ALLOWED_EXTENSIONS.includes(lowerExt)) {
      // Extension doesn't match the detected MIME type but is safe — use it
      // (e.g., .jpeg for image/jpeg is fine)
      ext = lowerExt
    } else {
      // Fallback to a safe default based on detected type
      ext = fileType === 'image' ? 'jpg' : 'mp4'
    }

    // 10. Read file buffer for magic byte validation
    const arrayBuffer = await file.arrayBuffer()

    // 11. Validate magic bytes to ensure file content matches declared type
    if (fileType === 'image') {
      if (!validateImageMagicBytes(arrayBuffer)) {
        logger.warn({ userId: authResult.user.id, fileName: file.name, type: file.type, bucket }, 'Image magic byte validation failed')
        return NextResponse.json(
          { success: false, error: 'File content does not match the declared image type. Only real images are allowed.' },
          { status: 400 }
        )
      }
    } else if (fileType === 'video') {
      if (!validateVideoMagicBytes(arrayBuffer)) {
        logger.warn({ userId: authResult.user.id, fileName: file.name, type: file.type, bucket }, 'Video magic byte validation failed')
        return NextResponse.json(
          { success: false, error: 'File content does not match the declared video type. Only real videos are allowed.' },
          { status: 400 }
        )
      }
    }

    // 12. Generate unique filename with Date.now() + crypto.randomUUID()
    const uniqueId = `${Date.now()}-${crypto.randomUUID().split('-')[0]}`
    const filePath = `${folder}/${uniqueId}.${ext}`

    // 13. Upload to Supabase Storage
    const result = await uploadToSupabase(bucket, filePath, arrayBuffer, file.type)

    if (!result.ok) {
      logger.error({ err: result.error, bucket, filePath, userId: authResult.user.id }, 'Upload to Supabase failed')

      // 14. Auto-create bucket if not found, then retry
      if (result.error?.includes('Bucket not found') || result.error?.includes('not found') || result.status === 404) {
        logger.info({ bucket }, 'Bucket not found, attempting auto-creation via ensureBucket...')

        const bucketCreated = await ensureBucket(bucket, {
          public: !isPrivateBucket(bucket),
          maxFileSizeMb: getBucketMaxFileSizeMb(bucket),
          allowedMimeTypes: getBucketMimeTypes(bucket),
        })

        if (bucketCreated) {
          // Retry upload after bucket creation
          const retryResult = await uploadToSupabase(bucket, filePath, arrayBuffer, file.type)

          if (retryResult.ok) {
            const isPrivate = isPrivateBucket(bucket)
            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`
            logger.info({ userId: authResult.user.id, bucket, filePath, autoCreated: true, isPrivate }, 'File uploaded after bucket auto-creation')

            // For private buckets, return the path so the client can request a signed URL
            // Public buckets return the direct public URL
            return NextResponse.json({
              success: true,
              data: {
                url: isPrivate ? undefined : publicUrl,
                path: filePath,
                type: fileType,
                isPrivate,
              },
            })
          }

          logger.error({ err: retryResult.error, bucket, filePath }, 'Upload retry failed after bucket auto-creation')
        }

        return NextResponse.json(
          { success: false, error: 'Storage bucket tidak ditemukan dan gagal dibuat otomatis.' },
          { status: 500 }
        )
      }

      // Generic error — don't leak internal details
      let userMessage = 'Upload gagal. Coba lagi nanti.'
      if (result.error?.includes('policy') || result.error?.includes('RLS') || result.error?.includes('permission')) {
        userMessage = 'Permission denied. Storage policy not configured.'
      } else if (result.error?.includes('payload') || result.error?.includes('size')) {
        userMessage = 'File terlalu besar untuk diupload.'
      }

      return NextResponse.json(
        { success: false, error: userMessage },
        { status: result.status === 404 ? 404 : 500 }
      )
    }

    // 15. Construct URL and return response
    // For private buckets (payments, deposits), the public URL won't work.
    // Return the path instead so the client can request a signed URL when needed.
    const isPrivate = isPrivateBucket(bucket)
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`

    logger.info({ userId: authResult.user.id, bucket, filePath, fileType, size: file.size, isPrivate }, 'File uploaded successfully')

    return NextResponse.json({
      success: true,
      data: {
        url: isPrivate ? undefined : publicUrl,
        path: filePath,
        type: fileType,
        isPrivate,
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'Upload POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
