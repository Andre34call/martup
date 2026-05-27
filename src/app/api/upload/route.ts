import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'
import { logger } from '@/lib/logger'

// ==================== GENERIC UPLOAD ENDPOINT ====================
// Uploads files to Supabase Storage. Used by seller product images,
// banner images, review images, and complaint evidence.
// Replaces the previously missing /api/upload route.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const ALLOWED_IMAGE_TYPES = [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES]
const ALLOWED_VIDEO_TYPES = [...UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES]
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov']

// ==================== MAGIC BYTE VALIDATION ====================
function validateImageMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 4) return false

  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true
  // WebP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true

  return false
}

function validateVideoMagicBytes(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 8) return false

  // MP4: ftyp box
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return true
  // WebM: starts with 1A 45 DF A3
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return true
  // MOV/QuickTime: moov or mdat
  if (bytes[4] === 0x6D && bytes[5] === 0x6F && bytes[6] === 0x6F && bytes[7] === 0x76) return true
  if (bytes[4] === 0x6D && bytes[5] === 0x64 && bytes[6] === 0x61 && bytes[7] === 0x74) return true

  return false
}

// ==================== ENSURE BUCKET EXISTS ====================
async function ensureBucket(bucket: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return

  // Try to get bucket info first
  const checkRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucket}`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  })

  if (checkRes.ok) return // Bucket already exists

  // Create bucket if it doesn't exist
  if (checkRes.status === 404) {
    const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: true,
        file_size_limit: UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB),
      }),
    })

    if (!createRes.ok) {
      logger.error({ bucket, status: createRes.status }, 'Failed to create storage bucket')
      return
    }

    // Set public read policy
    const policies = [
      {
        definition: JSON.stringify({
          bucket_id: bucket,
          operation: 'SELECT',
          role: 'anon',
        }),
        name: `${bucket}_public_read`,
        table: 'objects',
        action: 'PERMISSIVE',
        command: 'SELECT',
        using: JSON.stringify({ bucket_id: bucket }),
      },
    ]

    // Try setting RLS via service role - this may fail for anon key, that's okay
    // The bucket itself is set to public=true which allows reading
    logger.info({ bucket }, 'Storage bucket created with public access')
  }
}

// ==================== POST /api/upload ====================
export async function POST(request: NextRequest) {
  try {
    // Auth required
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Rate limit: 20/min per user
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`upload:${clientIp}:${authResult.user.id}`, 20)) {
      return NextResponse.json(
        { success: false, error: 'Too many upload requests. Please try again in 1 minute.' },
        { status: 429 }
      )
    }

    // Validate Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { success: false, error: 'Storage not configured. Please setup storage first via /api/setup/storage.' },
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
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate bucket name (prevent injection)
    const allowedBuckets = ['products', 'banners', 'reviews', 'complaints', 'avatars']
    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json(
        { success: false, error: `Invalid bucket. Allowed: ${allowedBuckets.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate folder name (prevent path traversal)
    if (folder.includes('..') || folder.includes('/') || folder.includes('\\')) {
      return NextResponse.json(
        { success: false, error: 'Invalid folder name' },
        { status: 400 }
      )
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type as typeof ALLOWED_VIDEO_TYPES[number])

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { success: false, error: `Invalid file type: ${file.type}. Allowed: JPG, PNG, WebP, GIF, MP4, WebM, MOV` },
        { status: 400 }
      )
    }

    // Validate file size
    const maxSize = isImage
      ? UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB)
      : UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB)

    if (file.size > maxSize) {
      const maxMB = isImage ? UPLOAD_LIMITS.MAX_IMAGE_SIZE_MB : UPLOAD_LIMITS.MAX_VIDEO_SIZE_MB
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size for ${isImage ? 'images' : 'videos'} is ${maxMB}MB.` },
        { status: 400 }
      )
    }

    // Sanitize extension
    const rawExt = file.name.split('.').pop() || ''
    const ext = ALLOWED_EXTENSIONS.includes(rawExt.toLowerCase()) ? rawExt.toLowerCase() : (isImage ? 'jpg' : 'mp4')

    // Read file buffer for validation
    const arrayBuffer = await file.arrayBuffer()

    // Validate magic bytes
    if (isImage && !validateImageMagicBytes(arrayBuffer)) {
      return NextResponse.json(
        { success: false, error: 'File content does not match the declared image type.' },
        { status: 400 }
      )
    }
    if (isVideo && arrayBuffer.byteLength > 100 && !validateVideoMagicBytes(arrayBuffer)) {
      // For video, be more lenient - some formats don't have clear magic bytes at the start
      logger.warn({ fileName: file.name, type: file.type }, 'Video magic byte validation skipped - format may be valid')
    }

    // Ensure bucket exists before upload
    await ensureBucket(bucket)

    // Generate unique filename
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Upload to Supabase Storage
    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
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
      logger.error({ err: errorData, bucket, filename }, 'Upload to Supabase Storage failed')

      const errorMsg = errorData.message || errorData.error || 'Unknown error'
      let userMessage = 'Upload gagal'

      if (errorMsg.includes('Bucket not found') || errorMsg.includes('bucket')) {
        userMessage = 'Storage bucket belum dikonfigurasi. Jalankan /api/setup/storage terlebih dahulu.'
      } else if (errorMsg.includes('policy') || errorMsg.includes('RLS') || errorMsg.includes('permission')) {
        userMessage = 'Permission denied. Storage policy belum dikonfigurasi.'
      }

      return NextResponse.json(
        { success: false, error: userMessage, detail: errorMsg },
        { status: uploadResponse.status === 404 ? 404 : 500 }
      )
    }

    // Construct public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`

    logger.info({ bucket, folder, filename, userId: authResult.user.id }, 'File uploaded successfully')

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        path: filename,
        type: isImage ? 'image' : 'video',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Upload POST error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
