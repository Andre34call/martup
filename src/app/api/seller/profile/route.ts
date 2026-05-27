import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import { serializeDecimal } from '@/lib/decimal-utils'

// Known Indonesian banks for validation
const KNOWN_INDONESIAN_BANKS = [
  'BCA', 'BNI', 'BRI', 'Mandiri', 'BTN', 'CIMB', 'Danamon', 'Permata',
  'BSI', 'OCBC', 'Maybank', 'Panin', 'BCA Syariah', 'BNI Syariah',
  'BRI Syariah', 'Bank Mega', 'Bank Bukopin', 'Bank Sinarmas', 'Bank Jago',
  'Bank Neo Commerce', 'Bank Jateng', 'Bank Jatim', 'Bank DKI',
  'Bank BJB', 'Bank Nagari', 'Bank Sumsel Babel', 'Bank Kaltim',
  'Bank Sulselbar', 'Bank NTB', 'Bank Papua', 'Bank Bengkulu',
  'Bank Maluku Malut', 'Bank NTT', 'Bank Aceh Syariah',
  'Seabank', 'Blu by BCA', 'Line Bank', 'Jenius', 'Digibank',
]

/**
 * Build the seller profile response object (shared by GET and PUT).
 */
async function buildSellerProfile(sellerId: string) {
  const fullSeller = await db.seller.findUnique({
    where: { id: sellerId },
    include: {
      wallet: {
        select: {
          id: true,
          balance: true,
          holdBalance: true,
        },
      },
      _count: {
        select: {
          products: { where: { status: 'active' } },
          orders: true,
        },
      },
    },
  })

  if (!fullSeller) return null

  const totalRevenue = await db.order.aggregate({
    where: {
      sellerId,
      status: { in: ['delivered', 'paid', 'shipped'] },
    },
    _sum: { totalAmount: true },
  })

  const pendingOrders = await db.order.count({
    where: {
      sellerId,
      status: 'pending',
    },
  })

  const profile = {
    id: fullSeller.id,
    userId: fullSeller.userId,
    storeName: fullSeller.storeName,
    storeSlug: fullSeller.storeSlug,
    storeDesc: fullSeller.storeDesc,
    storeAvatar: fullSeller.storeAvatar,
    storeBanner: fullSeller.storeBanner,
    storeAddress: fullSeller.storeAddress,
    isVerified: fullSeller.isVerified,
    isPremium: fullSeller.isPremium,
    rating: fullSeller.rating,
    totalSales: fullSeller.totalSales,
    totalProducts: fullSeller.totalProducts,
    responseTime: fullSeller.responseTime,
    bankAccount: fullSeller.bankAccount,
    bankName: fullSeller.bankName,
    bankHolder: fullSeller.bankHolder,
    autoReply: fullSeller.autoReply,
    commissionRate: fullSeller.commissionRate,
    createdAt: fullSeller.createdAt,
    wallet: fullSeller.wallet,
    stats: {
      activeProducts: fullSeller._count.products,
      totalOrders: fullSeller._count.orders,
      totalRevenue: totalRevenue._sum.totalAmount ?? 0,
      pendingOrders,
    },
  }

  return serializeDecimal(profile)
}

// GET /api/seller/profile - Fetch the authenticated seller's profile
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Find seller by userId
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
      select: { id: true },
    })

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Seller account required' },
        { status: 403 }
      )
    }

    const profile = await buildSellerProfile(seller.id)
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Seller not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: profile })
  } catch (error: unknown) {
    logger.error({ err: error }, 'GET /api/seller/profile error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch seller profile' },
      { status: 500 }
    )
  }
}

// PUT /api/seller/profile - Update the authenticated seller's profile
export async function PUT(request: NextRequest) {
  try {
    // Auth check
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Rate limit: 10/min per user
    if (!checkRateLimit(`seller-profile-update:${authResult.user.id}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    // Find seller by userId
    const seller = await db.seller.findUnique({
      where: { userId: authResult.user.id },
    })

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Seller account required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      storeName,
      storeDesc,
      storeAddress,
      storeCity,
      storeProvince,
      storePostalCode,
      bankAccount,
      bankName,
      bankHolder,
      autoReply,
    } = body

    // Build update data object
    const updateData: Record<string, unknown> = {}

    // --- Validate storeName ---
    if (storeName !== undefined) {
      if (typeof storeName !== 'string' || storeName.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Nama toko tidak boleh kosong' },
          { status: 400 }
        )
      }
      if (storeName.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Nama toko maksimal 100 karakter' },
          { status: 400 }
        )
      }
      updateData.storeName = storeName.trim()
    }

    // --- Validate storeDesc ---
    if (storeDesc !== undefined) {
      if (typeof storeDesc !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Deskripsi toko tidak valid' },
          { status: 400 }
        )
      }
      if (storeDesc.length > 1000) {
        return NextResponse.json(
          { success: false, error: 'Deskripsi toko maksimal 1000 karakter' },
          { status: 400 }
        )
      }
      updateData.storeDesc = storeDesc || null
    }

    // --- Validate storeAddress ---
    if (storeAddress !== undefined) {
      if (typeof storeAddress !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Alamat toko tidak valid' },
          { status: 400 }
        )
      }
      if (storeAddress.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Alamat toko maksimal 500 karakter' },
          { status: 400 }
        )
      }
      updateData.storeAddress = storeAddress || null
    }

    // --- Validate storeCity ---
    if (storeCity !== undefined) {
      if (typeof storeCity !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Kota toko tidak valid' },
          { status: 400 }
        )
      }
      if (storeCity.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Kota toko maksimal 100 karakter' },
          { status: 400 }
        )
      }
      updateData.storeCity = storeCity || null
    }

    // --- Validate storeProvince ---
    if (storeProvince !== undefined) {
      if (typeof storeProvince !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Provinsi toko tidak valid' },
          { status: 400 }
        )
      }
      if (storeProvince.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Provinsi toko maksimal 100 karakter' },
          { status: 400 }
        )
      }
      updateData.storeProvince = storeProvince || null
    }

    // --- Validate storePostalCode ---
    if (storePostalCode !== undefined) {
      if (typeof storePostalCode !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Kode pos toko tidak valid' },
          { status: 400 }
        )
      }
      if (storePostalCode.length > 10) {
        return NextResponse.json(
          { success: false, error: 'Kode pos toko maksimal 10 karakter' },
          { status: 400 }
        )
      }
      updateData.storePostalCode = storePostalCode || null
    }

    // --- Validate bank fields (all-or-nothing) ---
    const hasBankAccount = bankAccount !== undefined
    const hasBankName = bankName !== undefined
    const hasBankHolder = bankHolder !== undefined

    if (hasBankAccount || hasBankName || hasBankHolder) {
      // All three must be provided together
      if (!hasBankAccount || !hasBankName || !hasBankHolder) {
        return NextResponse.json(
          { success: false, error: 'Nomor rekening, nama bank, dan nama pemilik rekening harus diisi bersamaan' },
          { status: 400 }
        )
      }

      // Validate bankAccount: digits only (Indonesian bank account format)
      if (typeof bankAccount !== 'string' || bankAccount.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Nomor rekening tidak valid' },
          { status: 400 }
        )
      }
      if (!/^\d+$/.test(bankAccount.trim())) {
        return NextResponse.json(
          { success: false, error: 'Nomor rekening harus berisi angka saja' },
          { status: 400 }
        )
      }
      if (bankAccount.trim().length > 50) {
        return NextResponse.json(
          { success: false, error: 'Nomor rekening maksimal 50 digit' },
          { status: 400 }
        )
      }
      updateData.bankAccount = bankAccount.trim()

      // Validate bankName: must be a known Indonesian bank or at least 2 chars
      if (typeof bankName !== 'string' || bankName.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Nama bank tidak valid' },
          { status: 400 }
        )
      }
      const trimmedBankName = bankName.trim()
      if (trimmedBankName.length > 50) {
        return NextResponse.json(
          { success: false, error: 'Nama bank maksimal 50 karakter' },
          { status: 400 }
        )
      }
      const isKnownBank = KNOWN_INDONESIAN_BANKS.some(
        (b) => b.toLowerCase() === trimmedBankName.toLowerCase()
      )
      if (!isKnownBank && trimmedBankName.length < 2) {
        return NextResponse.json(
          { success: false, error: 'Nama bank tidak dikenali. Minimal 2 karakter.' },
          { status: 400 }
        )
      }
      updateData.bankName = trimmedBankName

      // Validate bankHolder: letters, spaces, dots only (real name format)
      if (typeof bankHolder !== 'string' || bankHolder.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Nama pemilik rekening tidak valid' },
          { status: 400 }
        )
      }
      const trimmedBankHolder = bankHolder.trim()
      if (trimmedBankHolder.length > 100) {
        return NextResponse.json(
          { success: false, error: 'Nama pemilik rekening maksimal 100 karakter' },
          { status: 400 }
        )
      }
      if (!/^[a-zA-Z\s.]+$/.test(trimmedBankHolder)) {
        return NextResponse.json(
          { success: false, error: 'Nama pemilik rekening hanya boleh berisi huruf, spasi, dan titik' },
          { status: 400 }
        )
      }
      updateData.bankHolder = trimmedBankHolder
    }

    // --- Validate autoReply ---
    if (autoReply !== undefined) {
      if (typeof autoReply !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Auto reply tidak valid' },
          { status: 400 }
        )
      }
      if (autoReply.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Auto reply maksimal 500 karakter' },
          { status: 400 }
        )
      }
      updateData.autoReply = autoReply || null
    }

    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada data yang diperbarui' },
        { status: 400 }
      )
    }

    // If storeName is being changed, regenerate the slug
    if (updateData.storeName) {
      const baseSlug = (updateData.storeName as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      // Add random suffix for uniqueness
      const randomSuffix = Math.random().toString(36).substring(2, 6)
      let newSlug = `${baseSlug}-${randomSuffix}`

      // Ensure slug uniqueness (excluding current seller)
      let slugCounter = 1
      while (
        await db.seller.findFirst({
          where: { storeSlug: newSlug, id: { not: seller.id } },
        })
      ) {
        newSlug = `${baseSlug}-${randomSuffix}-${slugCounter}`
        slugCounter++
      }

      updateData.storeSlug = newSlug
    }

    // DO NOT allow updating these protected fields
    const protectedFields = [
      'storeSlug', 'isVerified', 'isPremium', 'rating', 'totalSales',
      'totalProducts', 'commissionRate', 'userId',
    ]
    for (const field of protectedFields) {
      if (field in body && !(field === 'storeSlug' && updateData.storeSlug)) {
        return NextResponse.json(
          { success: false, error: `Field '${field}' tidak dapat diubah` },
          { status: 400 }
        )
      }
    }

    // Update the seller
    await db.seller.update({
      where: { id: seller.id },
      data: updateData,
    })

    logger.info({
      userId: authResult.user.id,
      sellerId: seller.id,
      updatedFields: Object.keys(updateData),
    }, 'Seller profile updated')

    // Return full updated profile
    const profile = await buildSellerProfile(seller.id)
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Seller not found after update' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: profile })
  } catch (error: unknown) {
    logger.error({ err: error }, 'PUT /api/seller/profile error')
    return NextResponse.json(
      { success: false, error: 'Failed to update seller profile' },
      { status: 500 }
    )
  }
}
