import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { serializeDecimal } from '@/lib/decimal-utils'
import { validateBody, createOrderSchema, updateOrderSchema } from '@/lib/validations'

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
    const { orderId, status, paymentStatus, trackingNumber } = validation.data

    // Find the order
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

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (status) {
      updateData.status = status
      // Set timestamp fields based on status
      if (status === 'paid') {
        updateData.paidAt = new Date()
      }
      if (status === 'shipped') {
        updateData.shippedAt = new Date()
      }
      if (status === 'delivered') {
        updateData.deliveredAt = new Date()
      }
    }

    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus
    }

    // Update order in a transaction (also update shipping if tracking number provided)
    const updatedOrder = await db.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: updateData,
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

      // If tracking number provided, update the shipping record
      if (trackingNumber) {
        const shipping = await tx.shipping.findUnique({
          where: { orderId },
        })

        if (shipping) {
          await tx.shipping.update({
            where: { orderId },
            data: { trackingNumber },
          })
        }
      }

      return order
    })

    // Re-fetch to get updated shipping if tracking number was set
    const finalOrder = trackingNumber
      ? await db.order.findUnique({
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
      : updatedOrder

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
      : updatedOrder

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
      subtotal,
      shippingCost,
      discountAmount = 0,
      taxAmount = 0,
      platformFee = 0,
      totalAmount,
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

    // SECURITY: Validate stock before decrementing
    for (const item of items as Array<{ productId: string; quantity: number; variantId?: string | null }>) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, stock: true },
      })
      if (!product) {
        return NextResponse.json(
          { success: false, error: `Product not found: ${item.productId}` },
          { status: 400 }
        )
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { success: false, error: `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}` },
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
            { success: false, error: `Insufficient stock for variant "${variant.name}". Available: ${variant.stock}, Requested: ${item.quantity}` },
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
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId,
          sellerId,
          addressId,
          status: 'pending',
          subtotal: subtotal ?? 0,
          shippingCost: shippingCost ?? 0,
          discountAmount,
          taxAmount,
          platformFee,
          totalAmount: totalAmount ?? 0,
          paymentMethod: paymentMethod || null,
          paymentStatus: 'unpaid',
          note: note || null,
          items: {
            create: items.map((item: {
              productId: string
              variantId?: string | null
              productName?: string
              variantName?: string | null
              price?: number
              quantity: number
              subtotal?: number
              image?: string | null
            }) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              productName: item.productName || '',
              variantName: item.variantName || null,
              price: item.price ?? 0,
              quantity: item.quantity,
              subtotal: item.subtotal ?? 0,
              image: item.image || null,
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

      // Update product sold count and stock
      // SECURITY: Re-validate stock inside transaction to prevent race conditions (oversell)
      for (const item of items as Array<{ productId: string; quantity: number; variantId?: string | null }>) {
        const currentProduct = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, name: true },
        })
        if (!currentProduct || currentProduct.stock < item.quantity) {
          throw new Error(`Stok tidak mencukupi untuk "${currentProduct?.name || item.productId}". Tersedia: ${currentProduct?.stock ?? 0}, Diminta: ${item.quantity}`)
        }

        // Also check variant stock if variantId is provided
        if (item.variantId) {
          const currentVariant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { stock: true, name: true },
          })
          if (currentVariant && currentVariant.stock < item.quantity) {
            throw new Error(`Stok varian tidak mencukupi untuk "${currentVariant.name}". Tersedia: ${currentVariant.stock}, Diminta: ${item.quantity}`)
          }
        }

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
