import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'
import { logger } from '@/lib/logger'

// ==================== CONFIG ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Bucket + folder whitelist — only these combinations are allowed
const ALLOWED_BUCKETS: Record<string, string[]> = {
  products: ['images', 'videos'],
  avatars: ['profiles'],
  banners: ['images'],
  streams: ['images', 'videos'],
  reviews: ['images', 'videos'],
}

// Bucket configuration for auto-creation
const BUCKET_CONFIG: Record<string, { public: boolean; fileSizeLimit: number; allowedMimeTypes: string[] }> = {
  products: {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
  },
  avatars: {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  banners: {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
  },
  streams: {
    public: true,
    fileSizeLimit: 100 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'],
  },
  reviews: {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
  },
}

// ==================== AUTO-CREATE BUCKET ====================

/**
 * Attempt to create a missing bucket in Supabase Storage.
 * Uses service role key to create the bucket with appropriate config.
 * Returns true if bucket now exists (created or already existed).
 */
async function ensureBucketExists(bucketId: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false

  const config = BUCKET_CONFIG[bucketId]
  if (!config) return false

  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: bucketId,
        name: bucketId,
        public: config.public,
        fileSizeLimit: config.fileSizeLimit,
        allowedMimeTypes: config.allowedMimeTypes,
      }),
    })

    if (res.ok) {
      logger.info({ bucketId }, 'Auto-created missing storage bucket')
      return true
    }

    // If 409 Conflict, bucket already exists (race condition)
    if (res.status === 409) {
      logger.info({ bucketId }, 'Bucket already exists (concurrent creation)')
      return true
    }

    const errData = await res.json().catch(() => ({}))
    logger.error({ bucketId, status: res.status, err: errData }, 'Failed to auto-create bucket')
    return false
  } catch (error) {
    logger.error({ err: error, bucketId }, 'Exception auto-creating bucket')
    return false
  }
}

// Allowed extensions per media type
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'quicktime']

// ==================== MAGIC BYTE VALIDATION ====================

/**
 * Validate image magic bytes (file signatures) to ensure the file content
 * matches the declared type. Prevents malicious files with spoofed extensions.
 */
function validateImageMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false

  // JPEG: starts with FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true

  // PNG: starts with 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true

  // GIF: starts with 47 49 46 38 (GIF8)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true

  // WebP: starts with 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return true

  return false
}

/**
 * Validate video magic bytes. Common video formats:
 * - MP4: starts with various boxes, common ones start with 00 00 00 XX 66 74 79 70 (ftyp)
 * - WebM: starts with 1A 45 DF A3 (EBML header)
 * - MOV/QuickTime: starts with 00 00 00 XX 6D 6F 6F 76 (moov) or 00 00 00 XX 66 74 79 70 (ftyp)
 */
function validateVideoMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false

  // WebM: starts with EBML header 1A 45 DF A3
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return true

  // MP4/MOV: look for "ftyp" box at offset 4
  if (
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  ) return true

  // MOV: look for "moov" or "mdat" boxes
  if (
    bytes[4] === 0x6D && bytes[5] === 0x6F && bytes[6] === 0x6F && bytes[7] === 0x76
  ) return true
  if (
    bytes[4] === 0x6D && bytes[5] === 0x64 && bytes[6] === 0x61 && bytes[7] === 0x74
  ) return true

  return false
}

// ==================== HELPERS ====================

function isImageType(mimeType: string): boolean {
  return (UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType)
}

function isVideoType(mimeType: string): boolean {
  return (UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES as readonly string[]).includes(mimeType)
}

// ==================== POST /api/upload ====================
// Generic file upload to Supabase Storage
// Accepts: FormData with file, bucket, folder
// Returns: { success: true, data: { url, path, type } }

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // SECURITY: Rate limit — 20 uploads per minute per user
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    if (!checkRateLimit(`upload:${authResult.user.id}:${clientIp}`, 20)) {
      return NextResponse.json(
        { success: false, error: 'Too many upload requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Validate Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('Supabase URL or Service Role Key not configured for uploads')
      return NextResponse.json(
        { success: false, error: 'Storage not configured. Contact admin.' },
        { status: 500 }
      )
    }

    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = formData.get('bucket') as string | null
    const folder = formData.get('folder') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!bucket || !folder) {
      return NextResponse.json(
        { success: false, error: 'Bucket and folder are required' },
        { status: 400 }
      )
    }

    // SECURITY: Validate bucket + folder against whitelist
    const allowedFolders = ALLOWED_BUCKETS[bucket]
    if (!allowedFolders || !allowedFolders.includes(folder)) {
      return NextResponse.json(
        { success: false, error: 'Invalid bucket or folder' },
        { status: 400 }
      )
    }

    // SECURITY: Validate file MIME type
    const mimeType = file.type
    const isImage = isImageType(mimeType)
    const isVideo = isVideoType(mimeType)

    if (!isImage && !isVideo) {
      const allowed = [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES, ...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES].join(', ')
      return NextResponse.json(
        { success: false, error: `Invalid file type: ${mimeType}. Allowed: ${allowed}` },
        { status: 400 }
      )
    }

    // SECURITY: Validate file size using centralized limits
    const maxSizeBytes = isVideo
      ? UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB)
      : UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB)
    const maxSizeMB = isVideo ? UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB : UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB

    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${maxSizeMB}MB for ${isVideo ? 'video' : 'image'} files.` },
        { status: 400 }
      )
    }

    // SECURITY: Sanitize file extension (prevent path traversal)
    const rawExt = file.name.split('.').pop() || ''
    const allowedExtensions = isVideo ? ALLOWED_VIDEO_EXTENSIONS : ALLOWED_IMAGE_EXTENSIONS
    const ext = allowedExtensions.includes(rawExt.toLowerCase()) ? rawExt.toLowerCase() : (isVideo ? 'mp4' : 'jpg')

    // Read file buffer for magic byte validation
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // SECURITY: Validate magic bytes to ensure file content matches extension
    if (isImage && !validateImageMagicBytes(bytes)) {
      return NextResponse.json(
        { success: false, error: 'File content does not match the declared image type. Only real images are allowed.' },
        { status: 400 }
      )
    }

    if (isVideo && !validateVideoMagicBytes(bytes)) {
      return NextResponse.json(
        { success: false, error: 'File content does not match the declared video type. Only real videos are allowed.' },
        { status: 400 }
      )
    }

    // Generate unique filename — sanitize to prevent path injection
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '')
    const filename = `${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Upload to Supabase Storage using REST API with SERVICE ROLE KEY
    // Service role key bypasses RLS policies — required for server-side uploads
    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': mimeType,
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
      logger.error({ err: errorData, bucket, folder, filename }, 'Upload to Supabase failed')

      const errorMsg = errorData.message || errorData.error || 'Unknown error'

      // AUTO-CREATE: If bucket not found, try to create it automatically and retry
      if (errorMsg.includes('Bucket not found') || errorMsg.includes('not found') || uploadResponse.status === 404) {
        logger.info({ bucket }, 'Bucket not found, attempting auto-creation...')
        const created = await ensureBucketExists(bucket)

        if (created) {
          // Retry the upload after bucket creation
          const retryResponse = await fetch(
            `${SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'apikey': SUPABASE_SERVICE_ROLE_KEY!,
                'Content-Type': mimeType,
              },
              body: arrayBuffer,
            }
          )

          if (retryResponse.ok) {
            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`
            logger.info(
              { userId: authResult.user.id, bucket, folder, filename, size: file.size, type: mimeType, autoCreated: true },
              'File uploaded successfully after bucket auto-creation'
            )
            return NextResponse.json({
              success: true,
              data: {
                url: publicUrl,
                path: filename,
                type: isVideo ? 'video' as const : 'image' as const,
              },
            })
          }

          // Retry also failed
          logger.error({ bucket, retryStatus: retryResponse.status }, 'Upload still failed after bucket auto-creation')
        }

        return NextResponse.json(
          { success: false, error: 'Storage bucket tidak ditemukan dan gagal dibuat otomatis. Silakan jalankan setup storage.' },
          { status: 500 }
        )
      }

      let userMessage = 'Upload gagal'
      if (errorMsg.includes('policy') || errorMsg.includes('RLS') || errorMsg.includes('permission')) {
        userMessage = 'Permission denied. Storage policy tidak dikonfigurasi.'
      }

      return NextResponse.json(
        { success: false, error: userMessage },
        { status: uploadResponse.status === 404 ? 404 : 500 }
      )
    }

    // Construct public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`

    logger.info(
      { userId: authResult.user.id, bucket, folder, filename, size: file.size, type: mimeType },
      'File uploaded successfully'
    )

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        path: filename,
        type: isVideo ? 'video' as const : 'image' as const,
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
