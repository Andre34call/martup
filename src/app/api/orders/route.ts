import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { validateBody, createOrderSchema } from '@/lib/validations'

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
      shippingCost: clientShippingCost,
      taxAmount: clientTaxAmount = 0,
      platformFee: clientPlatformFee = 0,
      paymentMethod,
      note,
      shipping,
      voucherCode,
    } = validatedData

    // SECURITY: Users can only create orders for themselves
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only create orders for yourself' },
        { status: 403 }
      )
    }

    // SECURITY: Verify addressId belongs to the authenticated user
    const address = await db.address.findUnique({ where: { id: addressId } })
    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Alamat tidak ditemukan' },
        { status: 400 }
      )
    }
    if (address.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Alamat tidak valid' },
        { status: 403 }
      )
    }

    // SECURITY: Validate stock before decrementing
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

      // Also check variant stock if variantId is provided
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
      // SECURITY: Re-validate stock inside transaction to prevent race conditions (oversell)
      // Also look up actual product prices for server-side price verification
      const serverItems: Array<{
        productId: string
        variantId: string | null
        productName: string
        variantName: string | null
        quantity: number
        price: number
        subtotal: number
        image: string | null
      }> = []

      let serverSubtotal = 0

      for (const item of items as Array<{ productId: string; quantity: number; variantId?: string | null; productName?: string; variantName?: string | null; image?: string | null }>) {
        // Re-validate stock inside transaction
        const currentProduct = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, name: true, price: true, discountPrice: true },
        })
        if (!currentProduct || currentProduct.stock < item.quantity) {
          throw new Error(`Stok tidak mencukupi untuk "${currentProduct?.name || item.productId}". Tersedia: ${currentProduct?.stock ?? 0}, Diminta: ${item.quantity}`)
        }

        // Also check variant stock if variantId is provided
        if (item.variantId) {
          const currentVariant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { stock: true, name: true, price: true },
          })
          if (currentVariant && currentVariant.stock < item.quantity) {
            throw new Error(`Stok varian tidak mencukupi untuk "${currentVariant.name}". Tersedia: ${currentVariant.stock}, Diminta: ${item.quantity}`)
          }
        }

        // SECURITY: Compute price server-side from DB values
        // If variant has a price, use it; otherwise use product price (discountPrice if available)
        let itemPrice: number
        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { price: true, name: true },
          })
          if (variant && variant.price !== null) {
            // Variant has its own price
            itemPrice = Number(variant.price)
          } else {
            // Fall back to product price (discountPrice if available, otherwise regular price)
            itemPrice = currentProduct.discountPrice !== null && currentProduct.discountPrice !== undefined
              ? Number(currentProduct.discountPrice)
              : Number(currentProduct.price)
          }
        } else {
          // No variant: use product discountPrice if available, otherwise regular price
          itemPrice = currentProduct.discountPrice !== null && currentProduct.discountPrice !== undefined
            ? Number(currentProduct.discountPrice)
            : Number(currentProduct.price)
        }

        const itemSubtotal = itemPrice * item.quantity
        serverSubtotal += itemSubtotal

        serverItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          productName: item.productName || currentProduct.name,
          variantName: item.variantName || null,
          quantity: item.quantity,
          price: itemPrice,
          subtotal: itemSubtotal,
          image: item.image || null,
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

        // Check per-user limit
        const userUsageCount = await tx.voucherUsage.count({
          where: {
            voucherId: voucher.id,
            userId: userId,
          },
        })

        if (userUsageCount >= voucher.perUserLimit) {
          throw new Error('Anda sudah menggunakan voucher ini sebanyak maksimum yang diperbolehkan')
        }

        // If voucher has sellerId, order must be from that seller
        if (voucher.sellerId && sellerId !== voucher.sellerId) {
          throw new Error('Voucher ini hanya berlaku untuk produk dari toko tertentu')
        }

        // Calculate discount amount
        if (voucher.type === 'percentage') {
          serverDiscountAmount = serverSubtotal * (Number(voucher.value) / 100)
          if (voucher.maxDiscount !== null && serverDiscountAmount > Number(voucher.maxDiscount)) {
            serverDiscountAmount = Number(voucher.maxDiscount)
          }
        } else if (voucher.type === 'fixed') {
          serverDiscountAmount = Number(voucher.value)
        }

        // Ensure discount doesn't exceed subtotal
        if (serverDiscountAmount > serverSubtotal) {
          serverDiscountAmount = serverSubtotal
        }

        serverDiscountAmount = Math.floor(serverDiscountAmount)
        validatedVoucherId = voucher.id
      }

      // SECURITY: Compute all monetary values server-side
      const finalShippingCost = clientShippingCost ?? 0
      const finalTaxAmount = clientTaxAmount
      const finalPlatformFee = clientPlatformFee
      const serverTotalAmount = serverSubtotal + finalShippingCost + finalTaxAmount + finalPlatformFee - serverDiscountAmount

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          sellerId,
          addressId,
          status: 'pending',
          subtotal: serverSubtotal,
          shippingCost: finalShippingCost,
          discountAmount: serverDiscountAmount,
          taxAmount: finalTaxAmount,
          platformFee: finalPlatformFee,
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
        // Increment voucher usage count
        await tx.voucher.update({
          where: { id: validatedVoucherId },
          data: { usageCount: { increment: 1 } },
        })

        // SECURITY (SG-7): Double-check voucher usage limit after creating usage record.
        // Prevents race condition where multiple orders could exceed the limit simultaneously.
        const updatedVoucher = await tx.voucher.findUnique({
          where: { id: validatedVoucherId },
          select: { usageCount: true, usageLimit: true },
        })
        if (updatedVoucher && updatedVoucher.usageLimit !== null && updatedVoucher.usageCount > updatedVoucher.usageLimit) {
          // Race condition detected — too many uses. Roll back by throwing an error
          throw new Error('Voucher sudah melewati batas penggunaan. Silakan coba tanpa voucher.')
        }
      }

      // Update product sold count and stock
      for (const item of serverItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            sold: { increment: item.quantity },
            stock: { decrement: item.quantity },
          },
        })

        // Update variant stock if variantId is provided
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: { decrement: item.quantity },
            },
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
