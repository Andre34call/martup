import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rzrfouzuxcxdbhadbppi.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fjYg2KrdC0xNzu90xqvpZw_8lYIH18Q'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const bucket = (formData.get('bucket') as string) || 'products'
    const folder = (formData.get('folder') as string) || 'images'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (5MB for images, 30MB for videos)
    const isVideo = file.type.startsWith('video/')
    const maxSize = isVideo ? 30 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `File too large. Max ${isVideo ? '30MB' : '5MB'}` },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: JPG, PNG, WebP, GIF, MP4, WebM' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Upload to Supabase Storage using REST API
    const arrayBuffer = await file.arrayBuffer()

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
      const errorData = await uploadResponse.json()
      console.error('Supabase storage upload error:', errorData)
      return NextResponse.json(
        { success: false, error: 'Upload failed: ' + (errorData.message || 'Unknown error') },
        { status: 500 }
      )
    }

    // Construct public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`

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
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
