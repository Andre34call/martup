import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit } from '@/lib/auth-middleware'

// POST /api/seller/register - Register user as seller
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // SECURITY: Rate limit seller registrations
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`seller-register:${clientIp}`, 5)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const {
      userId,
      storeName,
      storeDesc,
      storeAddress,
      storeAvatar,
      storeBanner,
      bankAccount,
      bankName,
      bankHolder,
    } = body

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }
    if (!storeName || storeName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'storeName is required' },
        { status: 400 }
      )
    }

    // SECURITY: Users can only register themselves as seller
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only register yourself as a seller' },
        { status: 403 }
      )
    }

    // Check if user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user is already a seller
    const existingSeller = await db.seller.findUnique({ where: { userId } })
    if (existingSeller) {
      return NextResponse.json(
        { success: false, error: 'User is already registered as a seller' },
        { status: 409 }
      )
    }

    // Generate store slug from store name
    const storeSlug = storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Ensure slug uniqueness
    let uniqueSlug = storeSlug
    let slugCounter = 1
    while (await db.seller.findUnique({ where: { storeSlug: uniqueSlug } })) {
      uniqueSlug = `${storeSlug}-${slugCounter}`
      slugCounter++
    }

    // Create seller and update user role in a transaction
    const seller = await db.$transaction(async (tx) => {
      // Update user role to seller
      await tx.user.update({
        where: { id: userId },
        data: { role: 'seller' },
      })

      // Create seller profile
      const newSeller = await tx.seller.create({
        data: {
          userId,
          storeName,
          storeSlug: uniqueSlug,
          storeDesc: storeDesc || null,
          storeAvatar: storeAvatar || null,
          storeBanner: storeBanner || null,
          storeAddress: storeAddress || null,
          bankAccount: bankAccount || null,
          bankName: bankName || null,
          bankHolder: bankHolder || null,
          isVerified: false,
          isPremium: false,
          rating: 0,
          totalSales: 0,
          totalProducts: 0,
          commissionRate: 0.05,
        },
      })

      // Create seller wallet if doesn't exist
      const existingWallet = await tx.wallet.findUnique({ where: { sellerId: newSeller.id } })
      if (!existingWallet) {
        await tx.wallet.create({
          data: {
            userId,
            sellerId: newSeller.id,
            balance: 0,
            holdBalance: 0,
          },
        })
      }

      return newSeller
    })

    // Fetch seller with user info
    const sellerWithUser = await db.seller.findUnique({
      where: { id: seller.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: sellerWithUser,
    }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Seller Register POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
