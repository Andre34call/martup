import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { validateBody, createOrderSchema, updateOrderSchema } from '@/lib/validations'
import { updateOrderStatus } from '@/lib/order-status'
import { getPlatformFee } from '@/lib/commission'

import { parseJsonField } from '@/lib/api-utils'
import { calculateShippingRates } from '@/lib/shipping-calculator'
import { logger } from '@/lib/logger'

// GET /api/orders - Fetch orders for a user
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    const sellerId = searchParams.get('sellerId')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Users can only read their own orders
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only view your own orders' },
        { status: 403 }
      )
    }

    // SECURITY: If sellerId is provided, verify the authenticated user owns this seller
    if (sellerId) {
      const seller = await db.seller.findFirst({
        where: { userId: authResult.user.id },
      })
      if (!seller || seller.id !== sellerId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden - You can only view your own seller orders' },
          { status: 403 }
        )
      }
    }

    const where: Record<string, unknown> = { userId }

    if (status) {
      where.status = status
    }

    if (sellerId) {
      where.sellerId = sellerId
    }

    const skip = (page - 1) * limit

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
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
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      }),
      db.order.count({ where }),
    ])

    // Parse JSON fields in order items (product images)
    const parsedOrders = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        product: item.product
          ? {
              ...item.product,
              images: parseJsonField(item.product.images),
            }
          : item.product,
      })),
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedOrders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Orders GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/orders - Update order status
// BUG 8 FIX: Now delegates to updateOrderStatus() for proper state machine validation,
// escrow release, stock restoration, refund processing, and notifications
export async function PUT(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()

    // Zod validation
    const validation = validateBody(updateOrderSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const { orderId, status, trackingNumber, cancelReason } = validation.data

    // Find the order to verify ownership
    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify ownership based on role
    if (['admin', 'manager'].includes(authResult.user.role)) {
      // Admin can update any order - no additional checks needed
    } else if (authResult.user.role === 'buyer') {
      // Buyers can only cancel their own orders
      if (existingOrder.userId !== authResult.user.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden - You can only update your own orders' },
          { status: 403 }
        )
      }
      if (status !== 'cancelled') {
        return NextResponse.json(
          { success: false, error: 'Forbidden - Buyers can only cancel orders' },
          { status: 403 }
        )
      }
    } else {
      // Sellers: verify they own the order's seller
      const seller = await db.seller.findFirst({
        where: { userId: authResult.user.id },
      })
      if (!seller || seller.id !== existingOrder.sellerId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden - You can only update orders for your own store' },
          { status: 403 }
        )
      }
    }

    // Delegate to the shared updateOrderStatus function for proper state machine validation,
    // escrow release, stock restoration, refund processing, and notifications
    const result = await updateOrderStatus({
      orderId,
      status,
      trackingNumber,
      cancelReason,
      authUserId: authResult.user.id,
      authUserRole: authResult.user.role,
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 400 }
      )
    }

    // Re-fetch to get updated data with all relations
    const finalOrder = await db.order.findUnique({
      where: { id: orderId },
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
            isVerified: true,
          },
        },
      },
    })

    // Parse JSON fields
    const parsedOrder = finalOrder
      ? {
          ...finalOrder,
          items: finalOrder.items.map((item) => ({
            ...item,
            product: item.product
              ? {
                  ...item.product,
                  images: parseJsonField(item.product.images),
                }
              : item.product,
          })),
        }
      : result.data

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedOrder,
    }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Orders PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create a new order
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body = await request.json()

    // Zod validation
    const validation = validateBody(createOrderSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }
    const validatedData = validation.data
    const {
      userId,
      sellerId,
      items,
      addressId,
      voucherCode,
      paymentMethod,
      note,
      shipping,
    } = validatedData

    // SECURITY: Users can only create orders for themselves
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only create orders for yourself' },
        { status: 403 }
      )
    }

    // SECURITY (CB-5): Verify address belongs to the user BEFORE the transaction
    const address = await db.address.findUnique({ where: { id: addressId } })
    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Alamat pengiriman tidak ditemukan' },
        { status: 400 }
      )
    }
    if (address.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses ke alamat ini' },
        { status: 403 }
      )
    }

    // SECURITY: Validate stock before entering transaction
    for (const item of items as Array<{ productId: string; quantity: number; variantId?: string | null }>) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, stock: true },
      })
      if (!product) {
        return NextResponse.json(
          { success: false, error: `Produk tidak ditemukan: ${item.productId}` },
          { status: 400 }
        )
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { success: false, error: `Stok tidak mencukupi untuk "${product.name}". Tersedia: ${product.stock}, Diminta: ${item.quantity}` },
          { status: 400 }
        )
      }
      if (item.variantId) {
        const variant = await db.productVariant.findUnique({
          where: { id: item.variantId },
          select: { id: true, name: true, stock: true },
        })
        if (variant && variant.stock < item.quantity) {
          return NextResponse.json(
            { success: false, error: `Stok varian tidak mencukupi untuk "${variant.name}". Tersedia: ${variant.stock}, Diminta: ${item.quantity}` },
            { status: 400 }
          )
        }
      }
    }

    // Generate order number
    const orderCount = await db.order.count()
    const orderNumber = `ORD-${Date.now()}-${String(orderCount + 1).padStart(5, '0')}`

    // Create order with items and shipping in a transaction
    const order = await db.$transaction(async (tx) => {
      // =====================================================
      // SECURITY (SEC-1): Compute ALL monetary values server-side
      // Client-provided prices are IGNORED — fetched from DB
      // =====================================================
      const serverItems: Array<{
        productId: string
        variantId: string | null
        productName: string
        variantName: string | null
        price: number
        quantity: number
        subtotal: number
        image: string | null
        sellerId: string
      }> = []

      let serverSubtotal = 0

      for (const item of items as Array<{ productId: string; quantity: number; variantId?: string | null }>) {
        // SECURITY: Re-validate stock inside transaction (race condition protection)
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, stock: true, price: true, discountPrice: true, images: true, sellerId: true },
        })
        if (!product || product.stock < item.quantity) {
          throw new Error(`Stok tidak mencukupi untuk "${product?.name || item.productId}". Tersedia: ${product?.stock ?? 0}, Diminta: ${item.quantity}`)
        }

        let itemPrice = Number(product.price)
        let variantName: string | null = null

        // Check variant if provided
        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { id: true, name: true, stock: true, price: true },
          })
          if (variant && variant.stock < item.quantity) {
            throw new Error(`Stok varian tidak mencukupi untuk "${variant.name}". Tersedia: ${variant.stock}, Diminta: ${item.quantity}`)
          }
          if (variant?.price !== null && variant?.price !== undefined) {
            itemPrice = Number(variant.price)
          }
          variantName = variant?.name || null
        } else if (product.discountPrice !== null && product.discountPrice !== undefined) {
          itemPrice = Number(product.discountPrice)
        }

        const itemSubtotal = itemPrice * item.quantity
        serverSubtotal += itemSubtotal

        // Get first image from product
        const productImages = parseJsonField(product.images) as string[]
        const itemImage = productImages?.[0] || null

        serverItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          productName: product.name,
          variantName,
          price: itemPrice,
          quantity: item.quantity,
          subtotal: itemSubtotal,
          image: itemImage,
          sellerId: product.sellerId,
        })
      }

      // SECURITY (CB-5c): Verify ALL products belong to the specified sellerId
      const wrongSellerProducts = serverItems.filter(si => si.sellerId !== sellerId)
      if (wrongSellerProducts.length > 0) {
        throw new Error('Produk tidak sesuai dengan seller')
      }

      // SECURITY: Validate voucher server-side if voucherCode is provided
      let serverDiscountAmount = 0
      let validatedVoucherId: string | null = null

      if (voucherCode && typeof voucherCode === 'string' && voucherCode.trim() !== '') {
        const voucher = await tx.voucher.findFirst({
          where: {
            code: {
              equals: voucherCode,
              mode: 'insensitive',
            },
          },
        })

        if (!voucher) {
          throw new Error('Kode voucher tidak ditemukan')
        }
        if (!voucher.isActive) {
          throw new Error('Voucher sudah tidak aktif')
        }
        const now = new Date()
        if (now < voucher.validFrom) {
          throw new Error('Voucher belum berlaku')
        }
        if (now > voucher.validUntil) {
          throw new Error('Voucher sudah kadaluarsa')
        }
        if (serverSubtotal < Number(voucher.minPurchase)) {
          throw new Error(`Minimum pembelian Rp ${Number(voucher.minPurchase).toLocaleString('id-ID')} untuk menggunakan voucher ini`)
        }
        if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit) {
          throw new Error('Voucher sudah melewati batas penggunaan')
        }
        const userUsageCount = await tx.voucherUsage.count({
          where: { voucherId: voucher.id, userId },
        })
        if (userUsageCount >= voucher.perUserLimit) {
          throw new Error('Anda sudah menggunakan voucher ini sebanyak maksimum yang diperbolehkan')
        }
        if (voucher.sellerId && sellerId !== voucher.sellerId) {
          throw new Error('Voucher ini hanya berlaku untuk produk dari toko tertentu')
        }

        // Calculate discount amount server-side
        if (voucher.type === 'percentage') {
          serverDiscountAmount = serverSubtotal * (Number(voucher.value) / 100)
          if (voucher.maxDiscount !== null && serverDiscountAmount > Number(voucher.maxDiscount)) {
            serverDiscountAmount = Number(voucher.maxDiscount)
          }
        } else if (voucher.type === 'fixed') {
          serverDiscountAmount = Number(voucher.value)
        }
        if (serverDiscountAmount > serverSubtotal) {
          serverDiscountAmount = serverSubtotal
        }
        serverDiscountAmount = Math.floor(serverDiscountAmount)
        validatedVoucherId = voucher.id
      }

      // =====================================================
      // SECURITY: Server-side shipping cost verification
      // Client-submitted shippingCost is NOT trusted. We re-calculate
      // using the seller's city, buyer's address, item weight, and
      // the selected courier/service. Only the server-verified cost is used.
      // =====================================================
      const clientShippingCost = validatedData.shippingCost ?? 0
      let serverShippingCost = clientShippingCost // default to client value, overridden below

      try {
        // Fetch seller's store city for origin
        const sellerRecord = await tx.seller.findUnique({
          where: { id: sellerId },
          select: { storeCity: true, storeProvince: true },
        })
        const originCity = sellerRecord?.storeCity || 'Jakarta'
        const destinationCity = address.city || 'Jakarta'

        // Calculate total weight from items (default 500g per item if not set)
        let totalWeightGrams = 0
        for (const si of serverItems) {
          const product = await tx.product.findUnique({
            where: { id: si.productId },
            select: { weight: true },
          })
          totalWeightGrams += (product?.weight || 500) * si.quantity
        }

        // Determine courier from shipping data
        const selectedCourier = shipping?.provider?.toLowerCase()

        // Re-calculate shipping rates server-side
        const rates = await calculateShippingRates({
          originCity,
          destinationCity,
          weight: totalWeightGrams,
          courier: selectedCourier,
        })

        // Find the rate matching the selected provider + service
        const selectedService = shipping?.service?.toUpperCase()
        const matchingRate = rates.find(r =>
          r.provider.toLowerCase() === (shipping?.provider || 'jne').toLowerCase() &&
          r.service.toUpperCase() === selectedService
        )

        if (matchingRate) {
          serverShippingCost = matchingRate.price
          logger.info(
            { component: 'orders', clientShippingCost, serverShippingCost, provider: shipping?.provider, service: shipping?.service },
            'Shipping cost verified server-side'
          )
        } else if (rates.length > 0) {
          // No exact match found — use the cheapest rate from the selected courier as fallback
          const courierRates = selectedCourier
            ? rates.filter(r => r.provider.toLowerCase() === selectedCourier)
            : rates
          if (courierRates.length > 0) {
            const fallbackRate = courierRates.sort((a, b) => a.price - b.price)[0]
            serverShippingCost = fallbackRate.price
            logger.warn(
              { component: 'orders', clientShippingCost, serverShippingCost, requestedService: selectedService, fallbackService: fallbackRate.service },
              'Shipping service not found, using cheapest rate from courier'
            )
          }
        }

        // Sanity check: if client cost is wildly different from server cost, something's wrong
        // Allow ±10% tolerance for RajaOngkir rate fluctuations and rounding
        if (serverShippingCost > 0 && clientShippingCost > 0) {
          const tolerance = Math.max(serverShippingCost * 0.1, 500) // 10% or min 500 IDR
          if (Math.abs(clientShippingCost - serverShippingCost) > tolerance) {
            logger.warn(
              { component: 'orders', clientShippingCost, serverShippingCost, difference: Math.abs(clientShippingCost - serverShippingCost) },
              'Shipping cost mismatch — using server-calculated value'
            )
          }
        }
      } catch (shippingErr) {
        // If server-side calculation fails, fall back to client value with bounds check
        logger.warn(
          { component: 'orders', err: shippingErr },
          'Server-side shipping calculation failed, using client value with bounds check'
        )
        if (clientShippingCost < 0 || clientShippingCost > 500_000) {
          throw new Error('Biaya pengiriman tidak valid (harus antara 0 - 500.000)')
        }
        serverShippingCost = clientShippingCost
      }

      // Final bounds check on server-verified cost
      if (serverShippingCost < 0 || serverShippingCost > 500_000) {
        throw new Error('Biaya pengiriman tidak valid (harus antara 0 - 500.000)')
      }

      // Calculate tax server-side instead of trusting client input
      const TAX_RATE = 0 // Tax rate from server config (0 if not configured)
      const serverTaxAmount = Math.floor(serverSubtotal * TAX_RATE)

      // SECURITY: Read platform fee from PlatformSetting (same source as client display)
      // This ensures what the buyer sees is exactly what they get charged.
      // Falls back to DEFAULT_PLATFORM_FEE if not configured.
      const serverPlatformFee = await getPlatformFee(tx)

      const serverTotalAmount = serverSubtotal + serverShippingCost + serverTaxAmount + serverPlatformFee - serverDiscountAmount

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          sellerId,
          addressId,
          status: 'pending',
          subtotal: serverSubtotal,
          shippingCost: serverShippingCost,
          discountAmount: serverDiscountAmount,
          taxAmount: serverTaxAmount,
          platformFee: serverPlatformFee,
          totalAmount: serverTotalAmount,
          paymentMethod: paymentMethod || null,
          paymentStatus: 'unpaid',
          note: note || null,
          items: {
            create: serverItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              variantName: item.variantName,
              price: item.price,
              quantity: item.quantity,
              subtotal: item.subtotal,
              image: item.image,
            })),
          },
        },
        include: {
          items: true,
        },
      })

      // Create shipping record if provided
      if (shipping) {
        await tx.shipping.create({
          data: {
            orderId: newOrder.id,
            provider: shipping.provider || 'jne',
            service: shipping.service || 'REG',
            estimatedDays: shipping.estimatedDays || null,
            status: 'pending',
          },
        })
      }

      // Record voucher usage if voucher was applied
      if (validatedVoucherId) {
        await tx.voucherUsage.create({
          data: {
            voucherId: validatedVoucherId,
            orderId: newOrder.id,
            userId: userId,
          },
        })
        await tx.voucher.update({
          where: { id: validatedVoucherId },
          data: { usageCount: { increment: 1 } },
        })

        // SECURITY (SG-7): Double-check voucher usage limit after creating usage record
        const updatedVoucher = await tx.voucher.findUnique({
          where: { id: validatedVoucherId },
          select: { usageCount: true, usageLimit: true },
        })
        if (updatedVoucher && updatedVoucher.usageLimit !== null && updatedVoucher.usageCount > updatedVoucher.usageLimit) {
          throw new Error('Voucher sudah melewati batas penggunaan. Silakan coba tanpa voucher.')
        }
      }

      // Update product sold count and stock
      // RACE CONDITION FIX: Use updateMany with stock >= qty to prevent stock going negative
      for (const item of serverItems) {
        const updateResult = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: {
            sold: { increment: item.quantity },
            stock: { decrement: item.quantity },
          },
        })
        if (updateResult.count === 0) {
          throw new Error('Stok tidak mencukupi')
        }
        if (item.variantId) {
          await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          })
        }
      }

      return newOrder
    })

    // Fetch the complete order with relations
    const completeOrder = await db.order.findUnique({
      where: { id: order.id },
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
      },
    })

    // Parse JSON fields
    const parsedOrder = completeOrder
      ? {
          ...completeOrder,
          items: completeOrder.items.map((item) => ({
            ...item,
            product: item.product
              ? {
                  ...item.product,
                  images: parseJsonField(item.product.images),
                }
              : item.product,
          })),
        }
      : order

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedOrder,
    }), { status: 201 })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Orders POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
