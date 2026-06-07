import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { validateCsrfRequest } from '@/lib/csrf'
import { sanitizeInput } from '@/lib/sanitize'

import { logger } from '@/lib/logger'
// GET /api/admin/banners - Fetch all banners
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  try {
    const banners = await db.banner.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ success: true, data: banners })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin banners GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/admin/banners - Create new banner
export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  // SECURITY: CSRF protection
  const csrfResult = await validateCsrfRequest(request)
  if (!csrfResult.valid) {
    return NextResponse.json(
      { success: false, error: 'CSRF validation failed. Silakan refresh halaman dan coba lagi.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { image, link, position, isActive, sortOrder, startDate, endDate } = body

    // SECURITY (Fix 6): Sanitize title to prevent XSS
    const title = sanitizeInput(body.title || '')

    if (!title || !image) {
      return NextResponse.json(
        { success: false, error: 'title and image are required' },
        { status: 400 }
      )
    }

    // SECURITY (Fix 6): Validate link URL — reject javascript: URLs
    if (link !== undefined && link !== null && link !== '') {
      if (typeof link !== 'string') {
        return NextResponse.json(
          { success: false, error: 'link must be a valid URL' },
          { status: 400 }
        )
      }
      const linkLower = link.trim().toLowerCase()
      if (linkLower.startsWith('javascript:') || linkLower.startsWith('data:') || linkLower.startsWith('vbscript:')) {
        return NextResponse.json(
          { success: false, error: 'Invalid link URL scheme' },
          { status: 400 }
        )
      }
      if (!linkLower.startsWith('https://') && !linkLower.startsWith('http://') && !linkLower.startsWith('/')) {
        return NextResponse.json(
          { success: false, error: 'link must start with https://, http://, or /' },
          { status: 400 }
        )
      }
    }

    // SECURITY (Fix 6): Validate image URL is from Supabase or starts with https://
    if (typeof image === 'string' && image.trim() !== '') {
      const imageLower = image.trim().toLowerCase()
      if (imageLower.startsWith('javascript:') || imageLower.startsWith('data:') || imageLower.startsWith('vbscript:')) {
        return NextResponse.json(
          { success: false, error: 'Invalid image URL scheme' },
          { status: 400 }
        )
      }
      if (!imageLower.startsWith('https://')) {
        const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
          : null
        if (!supabaseHost || !imageLower.includes(supabaseHost.toLowerCase())) {
          return NextResponse.json(
            { success: false, error: 'image must be from a valid source (https:// URL or Supabase)' },
            { status: 400 }
          )
        }
      }
    }

    // SECURITY: Validate position enum
    const validPositions = ['home_top', 'home_mid', 'home_bottom', 'category_top', 'search_top', 'product_detail', 'checkout_top', 'popup']
    if (position !== undefined && !validPositions.includes(position)) {
      return NextResponse.json(
        { success: false, error: `Invalid position. Must be one of: ${validPositions.join(', ')}` },
        { status: 400 }
      )
    }

    const createData: { title: string; image: string; link?: string; position?: string; isActive?: boolean; sortOrder?: number; startDate?: Date; endDate?: Date } = { title, image: image.trim() }
    if (link !== undefined && link !== null && link !== '') createData.link = link.trim()
    if (position !== undefined) createData.position = position
    if (isActive !== undefined) createData.isActive = isActive
    if (sortOrder !== undefined) createData.sortOrder = sortOrder
    if (startDate !== undefined) createData.startDate = new Date(startDate)
    if (endDate !== undefined) createData.endDate = new Date(endDate)

    const banner = await db.banner.create({ data: createData })

    return NextResponse.json({ success: true, data: banner })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin banners POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/banners - Update banner
export async function PUT(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  // SECURITY: CSRF protection
  const csrfResult = await validateCsrfRequest(request)
  if (!csrfResult.valid) {
    return NextResponse.json(
      { success: false, error: 'CSRF validation failed. Silakan refresh halaman dan coba lagi.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { bannerId, image, link, position, isActive, sortOrder } = body
    // SECURITY (Fix 6): Sanitize title to prevent XSS
    const title = body.title !== undefined ? sanitizeInput(body.title) : undefined

    if (!bannerId) {
      return NextResponse.json(
        { success: false, error: 'bannerId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Validate position enum
    const validPositions = ['home_top', 'home_mid', 'home_bottom', 'category_top', 'search_top', 'product_detail', 'checkout_top', 'popup']
    if (position !== undefined && !validPositions.includes(position)) {
      return NextResponse.json(
        { success: false, error: `Invalid position. Must be one of: ${validPositions.join(', ')}` },
        { status: 400 }
      )
    }

    // SECURITY (Fix 6): Validate link URL — reject javascript: URLs
    if (link !== undefined && link !== null && link !== '') {
      const linkLower = link.trim().toLowerCase()
      if (linkLower.startsWith('javascript:') || linkLower.startsWith('data:') || linkLower.startsWith('vbscript:')) {
        return NextResponse.json(
          { success: false, error: 'Invalid link URL scheme' },
          { status: 400 }
        )
      }
      if (!linkLower.startsWith('https://') && !linkLower.startsWith('http://') && !linkLower.startsWith('/')) {
        return NextResponse.json(
          { success: false, error: 'link must start with https://, http://, or /' },
          { status: 400 }
        )
      }
    }

    // SECURITY (Fix 6): Validate image URL
    if (image !== undefined && image !== null && image !== '') {
      const imageLower = image.trim().toLowerCase()
      if (imageLower.startsWith('javascript:') || imageLower.startsWith('data:') || imageLower.startsWith('vbscript:')) {
        return NextResponse.json(
          { success: false, error: 'Invalid image URL scheme' },
          { status: 400 }
        )
      }
      if (!imageLower.startsWith('https://')) {
        const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
          ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
          : null
        if (!supabaseHost || !imageLower.includes(supabaseHost.toLowerCase())) {
          return NextResponse.json(
            { success: false, error: 'image must be from a valid source (https:// URL or Supabase)' },
            { status: 400 }
          )
        }
      }
    }

    const updateData: { title?: string; image?: string; link?: string; position?: string; isActive?: boolean; sortOrder?: number } = {}
    if (title !== undefined) updateData.title = title
    if (image !== undefined) updateData.image = image.trim()
    if (link !== undefined && link !== null && link !== '') updateData.link = link.trim()
    if (position !== undefined) updateData.position = position
    if (isActive !== undefined) updateData.isActive = isActive
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder

    const banner = await db.banner.update({
      where: { id: bannerId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: banner })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin banners PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/banners - Delete banner
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (!authResult.success) return authErrorResponse(authResult)

  // SECURITY: CSRF protection
  const csrfResult = await validateCsrfRequest(request)
  if (!csrfResult.valid) {
    return NextResponse.json(
      { success: false, error: 'CSRF validation failed. Silakan refresh halaman dan coba lagi.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { bannerId } = body

    if (!bannerId) {
      return NextResponse.json(
        { success: false, error: 'bannerId is required' },
        { status: 400 }
      )
    }

    const banner = await db.banner.delete({
      where: { id: bannerId },
    })

    return NextResponse.json({ success: true, data: banner })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Admin banners DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
