import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'
import { ensureBucket } from '@/lib/ensure-bucket'
import { logger } from '@/lib/logger'

// ==================== CONFIG ====================

const uploadLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:upload:' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Allowed buckets and their folder/file-type configuration
const BUCKET_CONFIG: Record<string, {
  maxFileSizeMb: number
  allowedMimeTypes: readonly string[]
  allowedExtensions: string[]
}> = {
  products: {
    maxFileSizeMb: UPLOAD_LIMITS.MAX_PRODUCT_IMAGE_SIZE_MB,
    allowedMimeTypes: [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES, ...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov'],
  },
  avatars: {
    maxFileSizeMb: UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB,
    allowedMimeTypes: [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  },
  banners: {
    maxFileSizeMb: UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB,
    allowedMimeTypes: [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES, ...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm'],
  },
  streams: {
    maxFileSizeMb: UPLOAD_LIMITS.MAX_STREAM_VIDEO_SIZE_MB,
    allowedMimeTypes: [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES, ...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov'],
  },
  reviews: {
    maxFileSizeMb: UPLOAD_LIMITS.MAX_REVIEW_IMAGE_SIZE_MB,
    allowedMimeTypes: [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES, ...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm'],
  },
  deposits: {
    maxFileSizeMb: UPLOAD_LIMITS.MAX_COMPLAINT_IMAGE_SIZE_MB,
    allowedMimeTypes: [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  },
  payments: {
    maxFileSizeMb: UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB,
    allowedMimeTypes: [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  },
}

// ==================== MAGIC BYTE VALIDATION ====================

/**
 * Validate that an ArrayBuffer contains a real image by checking magic bytes.
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
 */
function validateVideoMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 8) return false

  // MP4: starts with various boxes. Common pattern: xx xx xx xx 66 74 79 70 (....ftyp)
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return true

  // WebM: starts with 1A 45 DF A3
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return true

  // MOV/QuickTime: starts with xx xx xx xx 6D 6F 6F 76 (....moov) or xx xx xx xx 6D 64 61 74 (....mdat)
  if (bytes.length >= 8) {
    const fourCC = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
    if (fourCC === 'moov' || fourCC === 'mdat' || fourCC === 'ftyp') return true
  }

  return false
}

// ==================== POST /api/upload ====================
// General-purpose file upload to Supabase Storage
// Accepts: FormData with file, bucket, folder

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth required
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Rate limit: 30/min per user
    const rateLimit = await uploadLimiter.check(authResult.user.id)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak upload. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    // Validate Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('Supabase URL or Service Role Key not configured for upload')
      return NextResponse.json(
        { success: false, error: 'Storage belum dikonfigurasi. Hubungi admin.' },
        { status: 500 }
      )
    }

    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = (formData.get('bucket') as string) || 'products'
    const folder = (formData.get('folder') as string) || 'images'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File tidak ditemukan' },
        { status: 400 }
      )
    }

    // SECURITY: Validate bucket name (whitelist)
    const bucketConfig = BUCKET_CONFIG[bucket]
    if (!bucketConfig) {
      return NextResponse.json(
        { success: false, error: `Bucket "${bucket}" tidak valid. Bucket yang tersedia: ${Object.keys(BUCKET_CONFIG).join(', ')}` },
        { status: 400 }
      )
    }

    // SECURITY: Validate folder name (prevent path traversal)
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/\.\./g, '')
    if (!sanitizedFolder || sanitizedFolder.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Folder tidak valid' },
        { status: 400 }
      )
    }

    // SECURITY: Validate file type
    if (!bucketConfig.allowedMimeTypes.includes(file.type as typeof bucketConfig.allowedMimeTypes[number])) {
      return NextResponse.json(
        { success: false, error: `Tipe file "${file.type}" tidak diizinkan. Yang diizinkan: ${bucketConfig.allowedExtensions.join(', ')}` },
        { status: 400 }
      )
    }

    // SECURITY: Validate file size
    const maxBytes = UPLOAD_LIMITS.mbToBytes(bucketConfig.maxFileSizeMb)
    if (file.size > maxBytes) {
      return NextResponse.json(
        { success: false, error: `File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)}MB). Maksimal ${bucketConfig.maxFileSizeMb}MB untuk bucket "${bucket}".` },
        { status: 400 }
      )
    }

    // SECURITY: Sanitize file extension (prevent path traversal / executable uploads)
    const rawExt = file.name.split('.').pop() || ''
    const ext = bucketConfig.allowedExtensions.includes(rawExt.toLowerCase()) ? rawExt.toLowerCase() : 'jpg'

    // Determine file type category
    const isVideo = (UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES as readonly string[]).includes(file.type)

    // Read file buffer for magic byte validation
    const arrayBuffer = await file.arrayBuffer()

    // SECURITY: Validate magic bytes to ensure file content matches declared type
    if (isVideo) {
      if (!validateVideoMagicBytes(arrayBuffer)) {
        return NextResponse.json(
          { success: false, error: 'Konten video tidak sesuai dengan tipe file yang dideklarasikan.' },
          { status: 400 }
        )
      }
    } else {
      if (!validateImageMagicBytes(arrayBuffer)) {
        return NextResponse.json(
          { success: false, error: 'Konten gambar tidak sesuai dengan tipe file yang dideklarasikan. Hanya gambar asli yang diizinkan.' },
          { status: 400 }
        )
      }
    }

    // Generate unique filename
    const filename = `${sanitizedFolder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Ensure bucket exists before uploading
    await ensureBucket(bucket, {
      maxFileSizeMb: bucketConfig.maxFileSizeMb,
      allowedMimeTypes: [...bucketConfig.allowedMimeTypes],
    })

    // Upload to Supabase Storage using REST API with SERVICE ROLE KEY
    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': file.type,
        },
        body: arrayBuffer,
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
      logger.error(
        { err: errorData, bucket, folder: sanitizedFolder, filename, status: uploadResponse.status },
        'Upload to Supabase Storage failed'
      )

      // Provide user-friendly error messages
      if (errorMsg.includes('Bucket not found') || errorMsg.includes('not found') || uploadResponse.status === 404) {
        return NextResponse.json(
          { success: false, error: 'Storage bucket tidak ditemukan. Hubungi admin untuk setup storage.' },
          { status: 500 }
        )
      }
      if (errorMsg.includes('policy') || errorMsg.includes('RLS') || errorMsg.includes('permission')) {
        return NextResponse.json(
          { success: false, error: 'Permission denied. Storage policy belum dikonfigurasi.' },
          { status: 500 }
        )
      }
      if (errorMsg.includes('payload') || errorMsg.includes('size') || errorMsg.includes('too large')) {
        return NextResponse.json(
          { success: false, error: `File melebihi batas upload bucket "${bucket}".` },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'Upload gagal. Silakan coba lagi.' },
        { status: 500 }
      )
    }

    // Construct public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`

    logger.info(
      {
        component: 'upload',
        userId: authResult.user.id,
        bucket,
        folder: sanitizedFolder,
        fileType: isVideo ? 'video' : 'image',
        fileSize: file.size,
        duration: Date.now() - startTime,
      },
      'File uploaded successfully'
    )

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        path: filename,
        type: isVideo ? 'video' : 'image',
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error, duration: Date.now() - startTime }, 'Upload POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server saat upload' },
      { status: 500 }
    )
  }
}
