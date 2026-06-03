import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { logger } from '@/lib/logger'
import { ensureBucket } from '@/lib/ensure-bucket'

// ==================== ROUTE SEGMENT CONFIG ====================
// Allow large request bodies for payment proof uploads (up to 10MB)
export const bodySizeLimit = '10mb'

// ==================== CONFIG ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const PAYMENT_BUCKET = 'payments'
const PAYMENT_FOLDER = 'proofs'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

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

  // WebP: starts with 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true

  return false
}

// ==================== SUPABASE UPLOAD HELPER ====================

/**
 * Upload a file buffer to Supabase Storage, auto-creating the bucket if needed.
 * Returns the public URL on success, or null on failure.
 */
async function uploadToSupabase(
  filename: string,
  arrayBuffer: ArrayBuffer,
  contentType: string
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null

  // Ensure bucket exists
  await ensureBucket(PAYMENT_BUCKET, {
    maxFileSizeMb: 10,
    allowedMimeTypes: ALLOWED_IMAGE_TYPES,
  })

  // Upload to Supabase Storage using REST API with SERVICE ROLE KEY
  const uploadResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${PAYMENT_BUCKET}/${filename}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': contentType,
      },
      body: arrayBuffer,
    }
  )

  if (!uploadResponse.ok) {
    let errorData: { message?: string; error?: string }
    try {
      errorData = await uploadResponse.json()
    } catch {
      errorData = { message: `HTTP ${uploadResponse.status}` }
    }

    const errorMsg = errorData.message || errorData.error || 'Unknown error'

    // If bucket not found, try creating it and retry
    if (errorMsg.includes('Bucket not found') || errorMsg.includes('not found') || uploadResponse.status === 404) {
      logger.info({ bucket: PAYMENT_BUCKET }, 'Payment bucket not found, attempting auto-creation...')

      try {
        const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: PAYMENT_BUCKET,
            name: PAYMENT_BUCKET,
            public: true,
            fileSizeLimit: 10 * 1024 * 1024,
            allowedMimeTypes: ALLOWED_IMAGE_TYPES,
          }),
        })

        if (createRes.ok || createRes.status === 409) {
          // Retry upload
          const retryResponse = await fetch(
            `${SUPABASE_URL}/storage/v1/object/${PAYMENT_BUCKET}/${filename}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Content-Type': contentType,
              },
              body: arrayBuffer,
            }
          )

          if (retryResponse.ok) {
            return `${SUPABASE_URL}/storage/v1/object/public/${PAYMENT_BUCKET}/${filename}`
          }
        }
      } catch (autoCreateErr) {
        logger.error({ err: autoCreateErr }, 'Payment bucket auto-creation failed')
      }

      return null
    }

    logger.error({ err: errorData }, 'Payment proof upload error')
    return null
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${PAYMENT_BUCKET}/${filename}`
}

// ==================== POST /api/orders/[id]/payment-proof ====================
// Buyer uploads payment proof (bukti transfer) for an order

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Step 2: Rate limit — 5 uploads per minute per user
    const rateLimitId = `payment-proof-post:${authResult.user.id}`
    if (!checkRateLimit(rateLimitId, 5)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const { id: orderId } = await params

    // Step 3: Find the order
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        paymentStatus: true,
        escrowStatus: true,
        note: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Step 4: Only the buyer who owns the order can upload payment proof
    if (order.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Hanya pembeli yang dapat mengunggah bukti pembayaran' },
        { status: 403 }
      )
    }

    // Step 5: Order must be in pending status and unpaid
    if (order.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Pesanan tidak dapat menerima bukti pembayaran. Status pesanan: ${order.status}` },
        { status: 400 }
      )
    }

    if (order.paymentStatus !== 'unpaid') {
      return NextResponse.json(
        { success: false, error: `Status pembayaran sudah "${order.paymentStatus}". Tidak dapat mengunggah bukti pembayaran lagi.` },
        { status: 400 }
      )
    }

    // Step 6: Validate Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Storage tidak dikonfigurasi. Hubungi admin.' },
        { status: 500 }
      )
    }

    // Step 7: Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const platformBankAccountId = formData.get('platformBankAccountId') as string | null
    const senderName = formData.get('senderName') as string | null
    const senderBank = formData.get('senderBank') as string | null

    // Validate file
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File bukti transfer wajib diunggah' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
      return NextResponse.json(
        { success: false, error: `Tipe file tidak valid. Hanya JPG, PNG, dan WebP yang diizinkan. Diterima: ${file.type}` },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File terlalu besar. Ukuran maksimum 10MB.' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!platformBankAccountId) {
      return NextResponse.json(
        { success: false, error: 'Rekening tujuan transfer wajib dipilih' },
        { status: 400 }
      )
    }

    if (!senderName || senderName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nama pengirim wajib diisi' },
        { status: 400 }
      )
    }

    if (!senderBank || senderBank.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bank asal pengirim wajib diisi' },
        { status: 400 }
      )
    }

    // Step 8: Verify the platform bank account exists and is active
    const bankAccount = await db.platformBankAccount.findUnique({
      where: { id: platformBankAccountId },
    })

    if (!bankAccount || !bankAccount.isActive) {
      return NextResponse.json(
        { success: false, error: 'Rekening tujuan transfer tidak valid atau tidak aktif' },
        { status: 400 }
      )
    }

    // Step 9: Sanitize file extension and validate magic bytes
    const rawExt = file.name.split('.').pop() || ''
    const ext = ALLOWED_EXTENSIONS.includes(rawExt.toLowerCase()) ? rawExt.toLowerCase() : 'jpg'

    const arrayBuffer = await file.arrayBuffer()

    // Validate magic bytes to ensure file content matches extension
    if (!validateImageMagicBytes(arrayBuffer)) {
      return NextResponse.json(
        { success: false, error: 'Konten file tidak sesuai dengan tipe gambar yang dideklarasikan. Hanya gambar asli yang diizinkan.' },
        { status: 400 }
      )
    }

    // Step 10: Generate unique filename and upload to Supabase Storage
    const filename = `${PAYMENT_FOLDER}/${orderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const publicUrl = await uploadToSupabase(filename, arrayBuffer, file.type)

    if (!publicUrl) {
      return NextResponse.json(
        { success: false, error: 'Gagal mengunggah bukti pembayaran. Coba lagi nanti.' },
        { status: 500 }
      )
    }

    // Step 11: Update the order with payment proof and metadata
    const senderInfo = JSON.stringify({
      senderName: senderName.trim(),
      senderBank: senderBank.trim(),
      uploadedAt: new Date().toISOString(),
    })

    const updatedOrder = await db.$transaction(async (tx) => {
      // Update order
      const result = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentProof: publicUrl,
          platformBankAccountId,
          paymentStatus: 'pending_verification',
          escrowStatus: 'held',
          note: order.note
            ? `${order.note}\n[Pembayaran] ${senderInfo}`
            : `[Pembayaran] ${senderInfo}`,
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                  slug: true,
                },
              },
              variant: true,
            },
          },
          shipping: true,
          seller: {
            select: {
              id: true,
              storeName: true,
              storeSlug: true,
              storeAvatar: true,
            },
          },
          platformBankAccount: true,
        },
      })

      // Create notification for admin about new payment proof
      const adminUsers = await tx.user.findMany({
        where: {
          role: { in: ['admin', 'manager', 'finance'] },
          isActive: true,
        },
        select: { id: true },
      })

      for (const admin of adminUsers) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            title: 'Bukti Pembayaran Baru',
            content: `Pembeli telah mengunggah bukti transfer untuk pesanan ${order.orderNumber}. Silakan verifikasi.`,
            type: 'order',
            refType: 'order',
            refId: orderId,
          },
        })
      }

      return result
    })

    logger.info({
      orderId,
      orderNumber: order.orderNumber,
      userId: authResult.user.id,
      platformBankAccountId,
    }, 'Payment proof uploaded successfully')

    return NextResponse.json(
      serializeDecimal({ success: true, data: updatedOrder })
    )
  } catch (error: unknown) {
    logger.error({ err: error }, 'POST /api/orders/[id]/payment-proof error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// ==================== GET /api/orders/[id]/payment-proof ====================
// Get payment info for an order (payment status, proof URL, bank account details)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { id: orderId } = await params

    // Step 2: Find the order with payment info
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        sellerId: true,
        status: true,
        paymentStatus: true,
        paymentProof: true,
        escrowStatus: true,
        totalAmount: true,
        platformBankAccountId: true,
        paidAt: true,
        note: true,
        platformBankAccount: {
          select: {
            id: true,
            bankName: true,
            bankCode: true,
            accountNumber: true,
            accountHolder: true,
            branch: true,
            isDefault: true,
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

    // Step 3: Verify the user is the buyer or has admin access
    const isBuyer = order.userId === authResult.user.id
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
      select: { id: true },
    })
    const isSeller = seller !== null && order.sellerId === seller.id
    const isAdmin = ['admin', 'manager', 'finance'].includes(authResult.user.role)

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke pesanan ini' },
        { status: 403 }
      )
    }

    // Step 4: Get available platform bank accounts (active ones)
    const availableBankAccounts = await db.platformBankAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        bankName: true,
        bankCode: true,
        accountNumber: true,
        accountHolder: true,
        branch: true,
        isDefault: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    // Step 5: Return payment info
    return NextResponse.json(serializeDecimal({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentProofUrl: order.paymentProof,
        escrowStatus: order.escrowStatus,
        totalAmount: order.totalAmount,
        platformBankAccountId: order.platformBankAccountId,
        platformBankAccount: order.platformBankAccount,
        paidAt: order.paidAt,
        availableBankAccounts,
      },
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'GET /api/orders/[id]/payment-proof error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
