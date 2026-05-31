import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, checkRateLimit, isSuperAdmin, isElevatedRole } from '@/lib/auth-middleware'
import { validateBody, sellerRegisterSchema } from '@/lib/validations'

import { logger } from '@/lib/logger'

// Elevated roles that should NOT be demoted to 'seller' when registering as a seller.
// Super Admin, Manager, and Division Admins must keep their elevated role.
// They can access the seller view via role switching (frontend-only).
const ELEVATED_ROLES_SET = new Set(['admin', 'manager', 'finance', 'pr', 'tech', 'cs', 'marketing', 'operations', 'legal', 'hr'])

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

    // Zod validation
    const validation = validateBody(sellerRegisterSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const validatedData = validation.data
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
    } = validatedData

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
    // SECURITY: If user has an elevated role (admin, manager, division), do NOT demote them to 'seller'.
    // They access the seller view via frontend role switching — their DB role must stay elevated.
    const isElevatedUser = ELEVATED_ROLES_SET.has(user.role)
    const isSuperAdminUser = isSuperAdmin(user.role, user.email)

    const seller = await db.$transaction(async (tx) => {
      // Only update role to 'seller' if user is currently a 'buyer'
      // Elevated users (admin, manager, division) keep their role and access seller view via switchRole
      if (!isElevatedUser) {
        await tx.user.update({
          where: { id: userId },
          data: { role: 'seller' },
        })
      }

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

      // Link or create seller wallet
      // Users already have a wallet from registration (with sellerId: null).
      // We must UPDATE the existing wallet to link it to the seller,
      // NOT create a new one (would violate Wallet.userId @unique constraint).
      const existingWallet = await tx.wallet.findUnique({ where: { userId } })
      if (existingWallet) {
        // Link existing wallet to the new seller
        await tx.wallet.update({
          where: { id: existingWallet.id },
          data: { sellerId: newSeller.id },
        })
      } else {
        // No wallet exists — create one linked to both user and seller
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
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Seller Register POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
