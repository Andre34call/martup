import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'

import { logger } from '@/lib/logger'
// ==================== CONFIG ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const AVATAR_BUCKET = 'avatars'
const AVATAR_FOLDER = 'profiles'
const MAX_AVATAR_SIZE = UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB) // Use centralized limit
const ALLOWED_IMAGE_TYPES = [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES]
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

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

// ==================== HELPERS ====================

/**
 * Extract the file path from a Supabase public URL.
 * Returns null if the URL does not point to our Supabase instance.
 */
function extractSupabasePath(url: string): string | null {
  if (!SUPABASE_URL) return null
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/`
  if (!url.startsWith(prefix)) return null
  return url.slice(prefix.length)
}

/**
 * Delete a file from Supabase Storage.
 * Silently ignores errors (best-effort cleanup).
 */
async function deleteFromSupabase(filePath: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}/${filePath}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
    })
  } catch {
    // Best-effort: don't fail the request if old file deletion fails
  }
}

// ==================== POST /api/user/avatar ====================
// Upload a new avatar, delete old one, update User record

export async function POST(request: NextRequest) {
  try {
    // Auth required
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Rate limit: 10/min per user
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`avatar-post:${clientIp}:${authResult.user.id}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again in 1 minute.' },
        { status: 429 }
      )
    }

    // Validate Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Storage not configured. Contact admin.' },
        { status: 500 }
      )
    }

    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // SECURITY: Validate file type - images ONLY
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
      return NextResponse.json(
        { success: false, error: `Invalid file type. Only JPG, PNG, WebP, and GIF images are allowed for avatars. Got: ${file.type}` },
        { status: 400 }
      )
    }

    // SECURITY: Validate file size using centralized limits
    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum avatar size is ${UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB}MB.` },
        { status: 400 }
      )
    }

    // SECURITY: Sanitize file extension (prevent path traversal)
    const rawExt = file.name.split('.').pop() || ''
    const ext = ALLOWED_EXTENSIONS.includes(rawExt.toLowerCase()) ? rawExt.toLowerCase() : 'jpg'

    // Read file buffer for magic byte validation
    const arrayBuffer = await file.arrayBuffer()

    // SECURITY: Validate magic bytes to ensure file content matches extension
    if (!validateImageMagicBytes(arrayBuffer)) {
      return NextResponse.json(
        { success: false, error: 'File content does not match the declared image type. Only real images are allowed.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const filename = `${AVATAR_FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Upload to Supabase Storage using REST API with SERVICE ROLE KEY
    // Service role key bypasses RLS policies — required for server-side uploads
    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}/${filename}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY!,
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
      logger.error({ err: errorData }, 'Avatar upload error')

      const errorMsg = errorData.message || errorData.error || 'Unknown error'

      // AUTO-CREATE: If bucket not found, try to create it automatically and retry
      if (errorMsg.includes('Bucket not found') || errorMsg.includes('not found') || uploadResponse.status === 404) {
        logger.info({ bucket: AVATAR_BUCKET }, 'Avatar bucket not found, attempting auto-creation...')

        try {
          const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': SUPABASE_SERVICE_ROLE_KEY!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: AVATAR_BUCKET,
              name: AVATAR_BUCKET,
              public: true,
              fileSizeLimit: 5 * 1024 * 1024,
              allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            }),
          })

          if (createRes.ok || createRes.status === 409) {
            // Retry upload after bucket creation
            const retryResponse = await fetch(
              `${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}/${filename}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'apikey': SUPABASE_SERVICE_ROLE_KEY!,
                  'Content-Type': file.type,
                },
                body: arrayBuffer,
              }
            )

            if (retryResponse.ok) {
              const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${filename}`
              logger.info({ userId: authResult.user.id, autoCreated: true }, 'Avatar uploaded after bucket auto-creation')

              // Update User record
              const currentUser = await db.user.findUnique({
                where: { id: authResult.user.id },
                select: { avatar: true },
              })
              if (currentUser?.avatar) {
                const oldPath = extractSupabasePath(currentUser.avatar)
                if (oldPath) await deleteFromSupabase(oldPath)
              }
              await db.user.update({ where: { id: authResult.user.id }, data: { avatar: publicUrl } })

              return NextResponse.json({ success: true, data: { avatar: publicUrl } })
            }
          }
        } catch (autoCreateErr) {
          logger.error({ err: autoCreateErr }, 'Avatar bucket auto-creation failed')
        }

        return NextResponse.json(
          { success: false, error: 'Storage bucket tidak ditemukan dan gagal dibuat otomatis.' },
          { status: 500 }
        )
      }

      let userMessage = 'Avatar upload failed'
      if (errorMsg.includes('policy') || errorMsg.includes('RLS') || errorMsg.includes('permission')) {
        userMessage = 'Permission denied. Storage policy not configured.'
      }

      return NextResponse.json(
        { success: false, error: userMessage, detail: errorMsg },
        { status: uploadResponse.status === 404 ? 404 : 500 }
      )
    }

    // Construct public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${filename}`

    // Fetch current user to check for old avatar
    const currentUser = await db.user.findUnique({
      where: { id: authResult.user.id },
      select: { avatar: true },
    })

    // SECURITY: Delete old avatar from Supabase Storage if it points to our Supabase
    if (currentUser?.avatar) {
      const oldPath = extractSupabasePath(currentUser.avatar)
      if (oldPath) {
        await deleteFromSupabase(oldPath)
      }
    }

    // Update User record with new avatar URL
    await db.user.update({
      where: { id: authResult.user.id },
      data: { avatar: publicUrl },
    })

    return NextResponse.json({
      success: true,
      data: { avatar: publicUrl },
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Avatar POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== DELETE /api/user/avatar ====================
// Remove avatar from storage and set User.avatar to null

export async function DELETE(request: NextRequest) {
  try {
    // Auth required
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Rate limit: 5/min per user
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`avatar-delete:${clientIp}:${authResult.user.id}`, 5)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again in 1 minute.' },
        { status: 429 }
      )
    }

    // Fetch current user to get avatar URL
    const currentUser = await db.user.findUnique({
      where: { id: authResult.user.id },
      select: { avatar: true },
    })

    if (!currentUser?.avatar) {
      return NextResponse.json(
        { success: false, error: 'No avatar to remove' },
        { status: 400 }
      )
    }

    // SECURITY: Delete avatar from Supabase Storage only if URL points to our Supabase
    const filePath = extractSupabasePath(currentUser.avatar)
    if (filePath) {
      await deleteFromSupabase(filePath)
    }

    // Set User.avatar to null
    await db.user.update({
      where: { id: authResult.user.id },
      data: { avatar: null },
    })

    return NextResponse.json({
      success: true,
      message: 'Avatar removed',
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Avatar DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
