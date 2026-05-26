import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-middleware'

import { logger } from '@/lib/logger'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication for file uploads
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // SECURITY: Validate Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { success: false, error: 'Storage belum dikonfigurasi. Hubungi admin.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const bucket = (formData.get('bucket') as string) || 'products'
    const folder = (formData.get('folder') as string) || 'images'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // SECURITY: Validate file size (5MB for images, 30MB for videos)
    const isVideo = file.type.startsWith('video/')
    const maxSize = isVideo ? 30 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `File terlalu besar. Maksimal ${isVideo ? '30MB' : '5MB'}` },
        { status: 400 }
      )
    }

    // SECURITY: Validate file type
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Tipe file tidak didukung. Format yang diizinkan: JPG, PNG, WebP, GIF, MP4, WebM' },
        { status: 400 }
      )
    }

    // SECURITY: Validate and sanitize file extension (prevent path traversal)
    const rawExt = file.name.split('.').pop() || ''
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov']
    const ext = allowedExtensions.includes(rawExt.toLowerCase()) ? rawExt.toLowerCase() : (isVideo ? 'mp4' : 'jpg')

    // SECURITY: Sanitize folder name (prevent path traversal)
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '')
    const safeBucket = bucket.replace(/[^a-zA-Z0-9_-]/g, '')

    // Generate unique filename
    const filename = `${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Upload to Supabase Storage using REST API
    const arrayBuffer = await file.arrayBuffer()

    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${safeBucket}/${filename}`,
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
      logger.error({ err: errorData }, 'Supabase storage upload error')

      // Provide user-friendly error messages
      const errorMsg = errorData.message || errorData.error || 'Unknown error'
      let userMessage = 'Upload gagal'

      if (errorMsg.includes('Bucket not found') || errorMsg.includes('bucket')) {
        userMessage = 'Storage belum dikonfigurasi. Silakan setup storage terlebih dahulu.'
        // Try to auto-setup storage
        try {
          const setupRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/setup_storage`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'apikey': SUPABASE_ANON_KEY,
            },
          })
          logger.info({ status: setupRes.status }, '[Upload] Auto-setup storage result')
        } catch {
          // Ignore setup errors
        }
      } else if (errorMsg.includes('policy') || errorMsg.includes('RLS') || errorMsg.includes('permission')) {
        userMessage = 'Permission ditolak. Storage policy belum dikonfigurasi.'
      }

      return NextResponse.json(
        { success: false, error: userMessage, detail: errorMsg },
        { status: uploadResponse.status === 404 ? 404 : 500 }
      )
    }

    // Construct public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${safeBucket}/${filename}`

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        path: filename,
        type: isVideo ? 'video' : 'image',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Upload error')
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
