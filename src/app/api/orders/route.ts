import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    const sellerId = searchParams.get('sellerId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    const where: Record<string, unknown> = { userId }

    if (status) {
      where.status = status
    }

    if (sellerId) {
      where.sellerId = sellerId
    }

    const orders = await db.order.findMany({
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
    })

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

    return NextResponse.json({
      success: true,
      data: parsedOrders,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Orders GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// PUT /api/orders - Update order status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, status, paymentStatus, trackingNumber } = body

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      )
    }

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

    return NextResponse.json({
      success: true,
      data: parsedOrder,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Orders PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create a new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
    } = body

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }
    if (!sellerId) {
      return NextResponse.json(
        { success: false, error: 'sellerId is required' },
        { status: 400 }
      )
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items array is required and must not be empty' },
        { status: 400 }
      )
    }
    if (!addressId) {
      return NextResponse.json(
        { success: false, error: 'addressId is required' },
        { status: 400 }
      )
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
              productName: string
              variantName?: string | null
              price: number
              quantity: number
              subtotal: number
              image?: string | null
            }) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              productName: item.productName,
              variantName: item.variantName || null,
              price: item.price,
              quantity: item.quantity,
              subtotal: item.subtotal,
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
      for (const item of items as Array<{ productId: string; quantity: number; variantId?: string | null }>) {
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

    return NextResponse.json({
      success: true,
      data: parsedOrder,
    }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Orders POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
