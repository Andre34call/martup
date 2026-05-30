import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'

const ALLOWED_MIME_TYPES = [...UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES]
const ALLOWED_BUCKETS = ['products', 'avatars', 'banners'] as const

const MAX_FILE_SIZES: Record<string, number> = {
  products: UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_PRODUCT_IMAGE_SIZE_MB),
  avatars: UPLOAD_LIMITS.mbToBytes(UPLOAD_LIMITS.MAX_AVATAR_SIZE_MB),
  banners: UPLOAD_LIMITS.mbToBytes(10), // 10MB default for banners
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials not configured')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      detectSessionInUrl: false,
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = (formData.get('bucket') as string) || 'products'
    const folder = (formData.get('folder') as string) || 'images'

    // Validate bucket
    if (!ALLOWED_BUCKETS.includes(bucket as typeof ALLOWED_BUCKETS[number])) {
      return NextResponse.json(
        { success: false, error: 'Invalid bucket' },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File wajib diisi' },
        { status: 400 }
      )
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
      return NextResponse.json(
        { success: false, error: `Tipe file tidak didukung. Tipe yang diizinkan: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size
    const maxSize = MAX_FILE_SIZES[bucket] || UPLOAD_LIMITS.mbToBytes(10)
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024)
      return NextResponse.json(
        { success: false, error: `Ukuran file terlalu besar. Maksimal ${maxSizeMB}MB untuk bucket ${bucket}` },
        { status: 400 }
      )
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const fileName = `${timestamp}-${randomStr}.${ext}`
    const filePath = `${folder}/${fileName}`

    // Upload to Supabase Storage
    const supabase = getSupabaseClient()
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      logger.error({ err: uploadError, bucket, filePath }, 'Supabase upload failed')
      return NextResponse.json(
        { success: false, error: 'Gagal mengupload file. Coba lagi.' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: filePath,
        type: 'image' as const,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Upload POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
