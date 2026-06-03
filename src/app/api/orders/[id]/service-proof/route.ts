import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'

// Rate limiter: 5 service proof uploads per minute per user
const serviceProofLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5, keyPrefix: 'rl:order:service-proof:' })

// ==================== POST /api/orders/[id]/service-proof ====================
// Allows a seller to upload proof of service completion for jasa (service) orders.
// Equivalent to adding a tracking number for physical orders.
// For service orders, "shipped" status means "jasa selesai / proof submitted".

// ==================== URL SANITIZATION ====================

const DANGEROUS_PROTOCOLS = ['blob:', 'data:', 'javascript:', 'vbscript:', 'file:']

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    // Only allow http: and https: protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false
    }
    return true
  } catch {
    return false
  }
}

function sanitizeUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    const lowerUrl = url.trim().toLowerCase()
    // Reject dangerous protocols
    for (const proto of DANGEROUS_PROTOCOLS) {
      if (lowerUrl.startsWith(proto)) return false
    }
    // Must be a valid URL with http/https
    return isValidUrl(url.trim())
  })
}

// ==================== POST HANDLER ====================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 2: Rate limit — 5 requests per minute per user
    const rateLimit = await serviceProofLimiter.check(authResult.user.id)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      logger.warn({ userId: authResult.user.id }, 'Service proof submission rate limit exceeded')
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    // Step 3: Parse request body
    const { id } = await params
    const body = await request.json()
    const { proofImages, note } = body as {
      proofImages?: string[]
      note?: string
    }

    // Step 4: Validate proofImages
    if (!proofImages || !Array.isArray(proofImages)) {
      return NextResponse.json(
        { success: false, error: 'proofImages wajib berupa array URL gambar' },
        { status: 400 }
      )
    }

    if (proofImages.length < 1 || proofImages.length > 5) {
      return NextResponse.json(
        { success: false, error: 'proofImages harus berisi 1-5 URL gambar' },
        { status: 400 }
      )
    }

    // Sanitize and validate each URL
    const sanitizedUrls = sanitizeUrls(proofImages)
    if (sanitizedUrls.length !== proofImages.length) {
      return NextResponse.json(
        { success: false, error: 'Setiap URL gambar harus berupa URL valid (http/https). URL blob:, data:, javascript: tidak diizinkan.' },
        { status: 400 }
      )
    }

    // Step 5: Validate note (optional, max 500 chars)
    if (note !== undefined && note !== null) {
      if (typeof note !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Catatan harus berupa teks' },
          { status: 400 }
        )
      }
      if (note.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Catatan maksimal 500 karakter' },
          { status: 400 }
        )
      }
    }

    // Step 6: Find the order and verify ownership
    const order = await db.order.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            storeAvatar: true,
          },
        },
        items: true,
        shipping: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Verify the authenticated user is the SELLER of this order
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
      select: { id: true },
    })

    if (!seller || order.sellerId !== seller.id) {
      return NextResponse.json(
        { success: false, error: 'Hanya penjual pesanan ini yang dapat mengirim bukti penyelesaian jasa' },
        { status: 403 }
      )
    }

    // Step 7: Verify the order is a service order
    if (!order.isServiceOrder) {
      return NextResponse.json(
        { success: false, error: 'Bukti penyelesaian jasa hanya untuk pesanan jasa (service order)' },
        { status: 400 }
      )
    }

    // Step 8: Verify the order status is 'processing'
    if (order.status !== 'processing') {
      return NextResponse.json(
        { success: false, error: 'Bukti penyelesaian hanya dapat dikirim saat pesanan berstatus "diproses"' },
        { status: 400 }
      )
    }

    // Step 9: Cannot submit proof twice
    if (order.serviceProofImages) {
      return NextResponse.json(
        { success: false, error: 'Bukti penyelesaian jasa sudah pernah dikirim untuk pesanan ini' },
        { status: 400 }
      )
    }

    // Step 10: Update the order in a transaction
    const now = new Date()
    const autoConfirmAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days

    const updatedOrder = await db.$transaction(async (tx) => {
      // Update order with service proof
      const result = await tx.order.update({
        where: { id },
        data: {
          serviceProofImages: JSON.stringify(sanitizedUrls),
          sellerCompletedAt: now,
          autoConfirmAt,
          status: 'shipped', // For services, "shipped" means "jasa selesai / proof submitted"
          shippedAt: now,
        },
        include: {
          items: true,
          shipping: true,
          seller: {
            select: {
              id: true,
              storeName: true,
              storeAvatar: true,
            },
          },
        },
      })

      // Create notification for buyer
      await tx.notification.create({
        data: {
          userId: order.userId,
          title: 'Bukti Penyelesaian Jasa',
          content: `Seller telah mengirim bukti penyelesaian jasa untuk pesanan ${order.orderNumber}. Silakan konfirmasi dalam 3 hari atau akan otomatis dikonfirmasi.`,
          type: 'order',
          refType: 'order',
          refId: order.id,
        },
      })

      // Create notification for seller (confirmation that proof was submitted)
      await tx.notification.create({
        data: {
          userId: order.seller.userId,
          title: 'Bukti Jasa Dikirim',
          content: `Bukti penyelesaian jasa untuk pesanan ${order.orderNumber} telah dikirim. Menunggu konfirmasi pembeli (maks 3 hari).`,
          type: 'order',
          refType: 'order',
          refId: order.id,
        },
      })

      return result
    })

    const duration = Date.now() - startTime
    logger.info({
      orderId: id,
      orderNumber: order.orderNumber,
      duration,
      userId: authResult.user.id,
    }, 'Service proof submitted successfully')

    return NextResponse.json(
      serializeDecimal({ success: true, data: updatedOrder })
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'POST /api/orders/[id]/service-proof error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== GET /api/orders/[id]/service-proof ====================
// Returns the service proof for an order. Both buyer and seller can view it.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { id } = await params

    // Step 2: Find the order
    const order = await db.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        isServiceOrder: true,
        serviceProofImages: true,
        sellerCompletedAt: true,
        autoConfirmAt: true,
        buyerConfirmedAt: true,
        status: true,
        userId: true,
        sellerId: true,
        seller: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Step 3: Verify the user is the buyer or seller of this order
    const isBuyer = order.userId === authResult.user.id
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
      select: { id: true },
    })
    const isSeller = seller !== null && order.sellerId === seller.id

    if (!isBuyer && !isSeller) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke pesanan ini' },
        { status: 403 }
      )
    }

    // Step 4: Return service proof data
    let proofImages: string[] = []
    if (order.serviceProofImages) {
      try {
        proofImages = JSON.parse(order.serviceProofImages) as string[]
      } catch {
        proofImages = []
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        isServiceOrder: order.isServiceOrder,
        status: order.status,
        proofImages,
        sellerCompletedAt: order.sellerCompletedAt,
        autoConfirmAt: order.autoConfirmAt,
        buyerConfirmedAt: order.buyerConfirmedAt,
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'GET /api/orders/[id]/service-proof error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
