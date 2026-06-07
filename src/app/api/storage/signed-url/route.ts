import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse, ELEVATED_ROLES } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { generateSignedUrl, PRIVATE_BUCKETS } from '@/lib/signed-url'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// Rate limiter: 30 signed URL requests per minute per user
const signedUrlLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  keyPrefix: 'rl:storage:signed-url:',
})

// ==================== POST /api/storage/signed-url ====================
// Generates a signed URL for accessing private objects in Supabase Storage.
// Only works for private buckets (payments, deposits).
// Requires authentication.

export async function POST(request: NextRequest) {
  try {
    // 1. Auth required
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // 2. Rate limit: 30 requests per minute per user
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await signedUrlLimiter.check(`${clientIp}:${authResult.user.id}`)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.`,
        },
        { status: 429 }
      )
    }

    // 3. Parse request body
    let body: { bucket?: string; path?: string; expiresIn?: number }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Request body harus berupa JSON yang valid.' },
        { status: 400 }
      )
    }

    const { bucket, path, expiresIn } = body

    // 4. Validate required fields
    if (!bucket || typeof bucket !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Parameter "bucket" wajib diisi.' },
        { status: 400 }
      )
    }

    if (!path || typeof path !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Parameter "path" wajib diisi.' },
        { status: 400 }
      )
    }

    // 5. Validate that the bucket is a private bucket
    if (!PRIVATE_BUCKETS.has(bucket)) {
      return NextResponse.json(
        {
          success: false,
          error: `Bucket "${bucket}" bukan bucket privat. Signed URL hanya tersedia untuk bucket privat: ${Array.from(PRIVATE_BUCKETS).join(', ')}.`,
        },
        { status: 400 }
      )
    }

    // 6. Validate expiresIn if provided
    if (expiresIn !== undefined && (typeof expiresIn !== 'number' || expiresIn < 1 || expiresIn > 86400)) {
      return NextResponse.json(
        { success: false, error: 'Parameter "expiresIn" harus berupa angka antara 1 dan 86400 detik (24 jam).' },
        { status: 400 }
      )
    }

    // 7. Sanitize path — prevent path traversal
    const sanitizedPath = path
      .split('/')
      .filter(segment => segment !== '..' && segment !== '.')
      .join('/')

    if (!sanitizedPath || sanitizedPath !== path) {
      return NextResponse.json(
        { success: false, error: 'Path tidak valid. Gunakan format path yang benar.' },
        { status: 400 }
      )
    }

    // 7.5 SECURITY: Authorization check — verify the user has access to this file
    // Private buckets contain sensitive documents; users should only access their own files
    const isAdmin = (ELEVATED_ROLES as readonly string[]).includes(authResult.user.role)
    if (!isAdmin) {
      const userId = authResult.user.id
      const folder = sanitizedPath.split('/')[0]

      if (bucket === 'payments') {
        // Payment proofs: check if user owns an order that references this file
        const orderWithPayment = await db.order.findFirst({
          where: {
            OR: [
              { userId },  // Buyer's order
              { seller: { userId } },  // Seller's order
            ],
            paymentReference: { contains: sanitizedPath },
          },
          select: { id: true },
        })
        if (!orderWithPayment) {
          return NextResponse.json(
            { success: false, error: 'Anda tidak memiliki akses ke file ini.' },
            { status: 403 }
          )
        }
      } else if (bucket === 'deposits') {
        // Deposit receipts: check if user owns the deposit
        const deposit = await db.deposit.findFirst({
          where: {
            userId,
            proofUrl: { contains: sanitizedPath },
          },
          select: { id: true },
        })
        if (!deposit) {
          return NextResponse.json(
            { success: false, error: 'Anda tidak memiliki akses ke file ini.' },
            { status: 403 }
          )
        }
      }
    }

    // 8. Generate signed URL
    const safeExpiresIn = expiresIn || 3600 // Default 1 hour
    const signedUrl = await generateSignedUrl(bucket, sanitizedPath, safeExpiresIn)

    // 9. Calculate expiry timestamp
    const expiresAt = Date.now() + safeExpiresIn * 1000

    logger.info(
      { userId: authResult.user.id, bucket, path: sanitizedPath, expiresIn: safeExpiresIn },
      'Signed URL generated'
    )

    return NextResponse.json({
      success: true,
      data: {
        url: signedUrl,
        expiresAt,
      },
    })
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('Supabase is not configured') || error.message.includes('Failed to generate signed URL'))) {
      logger.error({ err: error }, 'Signed URL generation failed')
      return NextResponse.json(
        { success: false, error: 'Gagal membuat signed URL. Coba lagi nanti.' },
        { status: 500 }
      )
    }

    logger.error({ err: error }, 'Signed URL endpoint error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server.' },
      { status: 500 }
    )
  }
}
