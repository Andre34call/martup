import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// ==================== FILE UPLOAD API ====================
// Handles image and video uploads to Supabase Storage.
// Security: Requires authentication + CSRF (handled by middleware).

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
]

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_VIDEO_SIZE = 30 * 1024 * 1024 // 30MB

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      logger.error({ component: 'upload' }, 'Supabase not configured for file uploads')
      return NextResponse.json(
        { success: false, error: 'File upload service is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.' },
        { status: 503 }
      )
    }

    // Rate limit: max 20 uploads per minute per user
    const rateLimitKey = `upload:${authResult.user.id}`
    if (!checkRateLimit(rateLimitKey, 20)) {
      return NextResponse.json(
        { success: false, error: 'Too many upload requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse multipart form data
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

    // Validate file type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)

    if (!isImage && !isVideo) {
      return NextResponse.json(
        { success: false, error: `File type "${file.type}" is not allowed. Allowed: JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV` },
        { status: 400 }
      )
    }

    // Validate file size
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024))
      return NextResponse.json(
        { success: false, error: `File size exceeds ${maxMB}MB limit` },
        { status: 400 }
      )
    }

    // Generate a unique file path
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50)
    const filePath = `${folder}/${authResult.user.id}/${timestamp}-${randomSuffix}-${safeName}`

    // Upload to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      logger.error({ err: uploadError, bucket, filePath }, 'Supabase storage upload error')

      // If bucket doesn't exist, try to set it up and retry once
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket not found')) {
        logger.info({ component: 'upload', bucket }, 'Attempting auto-setup of storage bucket')
        try {
          await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/setup/storage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${request.headers.get('authorization')?.replace('Bearer ', '')}`,
            },
          })
          // Retry the upload after bucket creation
          const retryResult = await supabase.storage
            .from(bucket)
            .upload(filePath, fileBuffer, {
              contentType: file.type,
              upsert: false,
            })

          if (retryResult.error) {
            return NextResponse.json(
              { success: false, error: `Upload failed after retry: ${retryResult.error.message}` },
              { status: 500 }
            )
          }

          // Get public URL for retry
          const { data: retryUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath)

          return NextResponse.json({
            success: true,
            data: {
              url: retryUrlData?.publicUrl || '',
              path: retryResult.data?.path || filePath,
              type: isVideo ? 'video' as const : 'image' as const,
            },
          }, { status: 201 })
        } catch (setupError) {
          logger.error({ err: setupError }, 'Auto-setup of storage bucket failed')
        }
      }

      return NextResponse.json(
        { success: false, error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    const publicUrl = urlData?.publicUrl || ''

    logger.info({
      component: 'upload',
      userId: authResult.user.id,
      bucket,
      folder,
      filePath,
      fileType: isVideo ? 'video' : 'image',
      fileSize: file.size,
    }, 'File uploaded successfully')

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        path: uploadData?.path || filePath,
        type: isVideo ? 'video' as const : 'image' as const,
      },
    }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Upload API error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
