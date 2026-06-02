import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { validateBody, createOrderSchema, updateOrderSchema } from '@/lib/validations'
import { updateOrderStatus } from '@/lib/order-status'

import { logger } from '@/lib/logger'
// Helper to safely parse JSON fields
function parseJsonField(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

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

    // Determine if this is a service order (all items are jasa/service products)
    const itemArray = items as Array<{ productId: string; quantity: number; variantId?: string | null }>
    const productIds = itemArray.map(item => item.productId)
    const productsInfo = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, productType: true },
    })
    const isServiceOrder = productsInfo.length > 0 && productsInfo.every(p => p.productType === 'jasa')

    if (isServiceOrder) {
      // Anti-fraud: limit active service orders between same buyer-seller pair
      const activeServiceOrders = await db.order.count({
        where: {
          userId,
          sellerId,
          isServiceOrder: true,
          status: { notIn: ['cancelled'] },
        },
      })
      if (activeServiceOrders >= 5) {
        return NextResponse.json(
          { success: false, error: 'Terlalu banyak pesanan jasa aktif dengan toko ini. Selesaikan pesanan yang ada terlebih dahulu.' },
          { status: 400 }
        )
      }
      // No address needed for service orders
    } else {
      // Physical order — addressId is required
      if (!addressId) {
        return NextResponse.json(
          { success: false, error: 'Alamat pengiriman wajib diisi untuk pesanan produk fisik' },
          { status: 400 }
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
    }

    // SECURITY: Validate stock before entering transaction
    for (const item of items as Array<{ productId: string; quantity: number; variantId?: string | null }>) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, stock: true, productType: true },
      })
      if (!product) {
        return NextResponse.json(
          { success: false, error: `Produk tidak ditemukan: ${item.productId}` },
          { status: 400 }
        )
      }
      // Skip stock check for jasa (service) products — they have unlimited stock
      if (product.productType !== 'jasa' && product.stock < item.quantity) {
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
        // Skip variant stock check for jasa products
        if (product.productType !== 'jasa' && variant && variant.stock < item.quantity) {
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
        productType: string
      }> = []

      let serverSubtotal = 0

      for (const item of items as Array<{ productId: string; quantity: number; variantId?: string | null }>) {
        // SECURITY: Re-validate stock inside transaction (race condition protection)
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, stock: true, price: true, discountPrice: true, images: true, productType: true },
        })
        if (!product) {
          throw new Error(`Produk tidak ditemukan: ${item.productId}`)
        }
        // Skip stock check for jasa (service) products — they have unlimited stock
        if (product.productType !== 'jasa' && product.stock < item.quantity) {
          throw new Error(`Stok tidak mencukupi untuk "${product.name}". Tersedia: ${product.stock}, Diminta: ${item.quantity}`)
        }

        let itemPrice = Number(product.price)
        let variantName: string | null = null

        // Check variant if provided
        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { id: true, name: true, stock: true, price: true },
          })
          // Skip variant stock check for jasa products
          if (product.productType !== 'jasa' && variant && variant.stock < item.quantity) {
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
          productType: product.productType,
        })
      }

      // SECURITY: Validate voucher server-side if voucherCode is provided
      let serverDiscountAmount = 0
      let validatedVoucherId: string | null = null

      if (voucherCode && typeof voucherCode === 'string' && voucherCode.trim() !== '') {
        const voucher = await tx.voucher.findFirst({
          where: {
            code: {
              equals: voucherCode.toUpperCase(),
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
      // BUG 16 FIX: Validate shipping cost and compute tax server-side
      // Previously, client-provided shippingCost and taxAmount were
      // only loosely bounds-checked. Now:
      // - shippingCost: strict bounds [0, 500000]
      // - taxAmount: computed server-side from fixed rate (not trusted from client)
      // =====================================================
      // Service orders have no shipping cost; physical orders use client-provided cost
      const clientShippingCost = isServiceOrder ? 0 : (validatedData.shippingCost ?? 0)

      // Validate shipping cost is within reasonable bounds (skip for service orders — always 0)
      if (!isServiceOrder && (clientShippingCost < 0 || clientShippingCost > 500_000)) {
        throw new Error('Biaya pengiriman tidak valid (harus antara 0 - 500.000)')
      }

      // BUG 16 FIX: Calculate tax server-side instead of trusting client input
      const TAX_RATE = 0 // Tax rate from server config (0 if not configured)
      const serverTaxAmount = Math.floor(serverSubtotal * TAX_RATE)

      // SECURITY: Compute platform fee server-side
      // Client should not control this value — it directly affects revenue
      // Service orders use higher rate (8%) to cover increased risk and dispute handling
      const PLATFORM_FEE_RATE = isServiceOrder ? 0.08 : 0.03
      const serverPlatformFee = Math.floor(serverSubtotal * PLATFORM_FEE_RATE)

      const serverTotalAmount = serverSubtotal + clientShippingCost + serverTaxAmount + serverPlatformFee - serverDiscountAmount

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          sellerId,
          addressId: isServiceOrder ? null : (addressId || null),
          isServiceOrder,
          status: 'pending',
          subtotal: serverSubtotal,
          shippingCost: isServiceOrder ? 0 : clientShippingCost,
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

      // Create shipping record if provided (skip for service orders — no physical shipping)
      if (shipping && !isServiceOrder) {
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

      // Update product sold count and stock (don't decrement stock for jasa products)
      for (const item of serverItems) {
        const isJasa = item.productType === 'jasa'
        if (isJasa) {
          // Only increment sold count for jasa products — stock is unlimited
          await tx.product.update({
            where: { id: item.productId },
            data: { sold: { increment: item.quantity } },
          })
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              sold: { increment: item.quantity },
              stock: { decrement: item.quantity },
            },
          })
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { decrement: item.quantity } },
            })
          }
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
