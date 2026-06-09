import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { validateCsrfRequest } from '@/lib/csrf'
import { uploadLimiter } from '@/lib/rate-limit'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'
import { logger } from '@/lib/logger'

// ==================== CONFIG ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Allowed buckets (whitelist — prevents arbitrary bucket access)
const ALLOWED_BUCKETS = new Set([
  'products',
  'avatars',
  'banners',
  'streams',
  'reviews',
  'deposits',
  'payments',
])

// Allowed folders within buckets (whitelist)
const ALLOWED_FOLDERS = new Set([
  'images',
  'videos',
  'avatars',
  'banners',
  'streams',
  'reviews',
  'deposits',
  'payments',
  'proofs',
])

// Max file sizes per bucket
const BUCKET_SIZE_LIMITS: Record<string, number> = {
  avatars: UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB),
  deposits: UPLOAD_LIMITS.mbToBytes(5),
  payments: UPLOAD_LIMITS.mbToBytes(10),
  streams: UPLOAD_LIMITS.mbToBytes(100),
}

// All allowed MIME types
const ALL_ALLOWED_TYPES = new Set([
  ...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES,
  ...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES,
])

// ==================== HELPER: Supabase Storage REST API ====================

function supabaseHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'apikey': SUPABASE_SERVICE_ROLE_KEY!,
  }
}

/** Get public URL for an object in a public bucket */
function getPublicUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

// ==================== POST /api/upload ====================
// Upload a file to Supabase Storage with comprehensive security checks.

export async function POST(request: NextRequest) {
  try {
    // Step 1: Check if Supabase Storage is configured
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('Supabase Storage not configured — cannot upload files')
      return NextResponse.json(
        { success: false, error: 'Storage belum dikonfigurasi. Silakan hubungi admin.' },
        { status: 503 }
      )
    }

    // Step 2: Verify authentication — only authenticated users can upload
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 3: CSRF protection
    const csrfResult = await validateCsrfRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json(
        { success: false, error: 'CSRF validation failed. Silakan refresh halaman dan coba lagi.' },
        { status: 403 }
      )
    }

    // Step 4: Rate limit — 10 uploads per minute per user
    const rateLimitId = `upload-${authResult.user.id}`
    const rateLimitResult = await uploadLimiter.check(rateLimitId)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: 'Upload terlalu sering. Max 10 upload per menit.' },
        { status: 429 }
      )
    }

    // Step 5: Parse FormData
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Gagal membaca data upload. Pastikan file tidak terlalu besar.' },
        { status: 400 }
      )
    }

    const file = formData.get('file') as File | null
    const bucket = (formData.get('bucket') as string) || 'products'
    const folder = (formData.get('folder') as string) || 'images'

    // Step 6: Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File wajib diisi' },
        { status: 400 }
      )
    }

    // Step 7: Validate bucket (whitelist)
    if (!ALLOWED_BUCKETS.has(bucket)) {
      logger.warn({ bucket, userId: authResult.user.id }, 'Upload attempted to invalid bucket')
      return NextResponse.json(
        { success: false, error: `Bucket '${bucket}' tidak valid` },
        { status: 400 }
      )
    }

    // Step 8: Validate folder (whitelist)
    if (!ALLOWED_FOLDERS.has(folder)) {
      logger.warn({ folder, userId: authResult.user.id }, 'Upload attempted to invalid folder')
      return NextResponse.json(
        { success: false, error: `Folder '${folder}' tidak valid` },
        { status: 400 }
      )
    }

    // Step 9: Validate file type
    if (!ALL_ALLOWED_TYPES.has(file.type as typeof ALL_ALLOWED_TYPES extends Set<infer T> ? T : never)) {
      logger.warn({ fileType: file.type, fileName: file.name, userId: authResult.user.id }, 'Upload rejected: invalid file type')
      return NextResponse.json(
        { success: false, error: `Tipe file '${file.type || 'unknown'}' tidak didukung. Gunakan JPEG, PNG, WebP, GIF, MP4, WebM, atau MOV.` },
        { status: 400 }
      )
    }

    // Step 10: Validate file size
    const isVideo = file.type.startsWith('video/')
    const maxBytes = BUCKET_SIZE_LIMITS[bucket]
      ?? (isVideo
        ? UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB)
        : UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB))

    if (file.size > maxBytes) {
      const maxMB = Math.round(maxBytes / (1024 * 1024))
      const fileMB = Math.round(file.size / (1024 * 1024))
      return NextResponse.json(
        { success: false, error: `File terlalu besar (${fileMB}MB). Maksimal ${maxMB}MB.` },
        { status: 400 }
      )
    }

    // Step 11: Validate file is not empty
    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'File kosong tidak dapat diupload' },
        { status: 400 }
      )
    }

    // Step 12: Generate unique file path to prevent collisions and path traversal
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 10)
    // Sanitize filename: remove path separators and special chars
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 100) // Limit filename length
    const fileExtension = sanitizedFileName.includes('.')
      ? sanitizedFileName.substring(sanitizedFileName.lastIndexOf('.'))
      : getExtensionFromMimeType(file.type)
    const uniqueFileName = `${timestamp}_${randomStr}${fileExtension}`
    const filePath = `${folder}/${authResult.user.id}/${uniqueFileName}`

    // Step 13: Upload to Supabase Storage via REST API
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`
    const arrayBuffer = await file.arrayBuffer()

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(),
        'Content-Type': file.type,
        'x-upsert': 'false', // Don't overwrite existing files
      },
      body: arrayBuffer,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      let errorMessage = 'Gagal mengupload file ke storage'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorJson.message || errorMessage
      } catch {
        // Use default error message
      }
      logger.error({
        status: uploadResponse.status,
        error: errorText,
        bucket,
        filePath,
        userId: authResult.user.id,
      }, 'Supabase Storage upload failed')
      return NextResponse.json(
        { success: false, error: `Upload gagal: ${errorMessage}` },
        { status: 502 }
      )
    }

    // Step 14: Build public URL
    const publicUrl = getPublicUrl(bucket, filePath)

    // Step 15: Determine file type for response
    const fileType: 'image' | 'video' = isVideo ? 'video' : 'image'

    logger.info({
      bucket,
      filePath,
      fileType,
      fileSize: file.size,
      userId: authResult.user.id,
    }, 'File uploaded successfully')

    // Step 16: Return success response matching UploadResult interface
    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        path: filePath,
        type: fileType,
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

// ==================== HELPER ====================

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  }
  return mimeToExt[mimeType] || '.bin'
}
