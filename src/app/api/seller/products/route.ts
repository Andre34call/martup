import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { createRateLimiter } from '@/lib/rate-limit'
import { parseJsonField } from '@/lib/api-utils'
import { sanitizeInput } from '@/lib/sanitize'
import { serializeDecimal } from '@/lib/decimal-utils'
import { UPLOAD_LIMITS } from '@/lib/upload-limits'

import { logger } from '@/lib/logger'

const sellerProductsLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20, keyPrefix: 'rl:seller:products:' })

// GET /api/seller/products - Fetch products for a specific seller
// SECURITY: Only the seller themselves (or admins) can see all products including drafts.
// Unauthenticated or non-owner requests only see active products.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')

    if (!sellerId) {
      return NextResponse.json(
        { success: false, error: 'sellerId is required' },
        { status: 400 }
      )
    }

    // Check if the request is from the seller themselves or an admin
    let isOwnerOrAdmin = false
    const authResult = await verifyAuth(request)
    if (authResult.success) {
      const seller = await db.seller.findFirst({
        where: { userId: authResult.user.id },
        select: { id: true },
      })
      if (seller?.id === sellerId || ['admin', 'manager'].includes(authResult.user.role)) {
        isOwnerOrAdmin = true
      }
    }

    const products = await db.product.findMany({
      where: {
        sellerId,
        // Non-owners only see active products (no drafts or blocked items)
        ...(isOwnerOrAdmin ? {} : { status: 'active' }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        variants: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Parse JSON fields
    const parsedProducts = products.map((product) => ({
      ...product,
      images: parseJsonField(product.images),
      tags: parseJsonField(product.tags),
    }))

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedProducts,
    }))
  } catch (error: unknown) {
    logger.error({ err: error }, 'Seller Products GET error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/seller/products - Create a new product with variants
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Rate limit: max 20 operations per minute
    const rateLimit = await sellerProductsLimiter.check(authResult.user.id)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const {
      sellerId,
      categoryId,
      slug,
      price,
      discountPrice,
      images,
      videoUrl,
      stock,
      minOrder = 1,
      weight,
      condition = 'new',
      productType = 'product',
      serviceDuration,
      serviceLocation,
      status = 'active',
      // SECURITY (Fix 2): isFeatured, isFlashSale, flashSaleEnd are admin-only fields.
      // We destructure them to remove from body but ignore the values.
      isFeatured: _isFeatured,
      isFlashSale: _isFlashSale,
      flashSaleEnd: _flashSaleEnd,
      tags,
      variants = [],
    } = body

    const isJasa = productType === 'jasa'

    // SECURITY (Fix 8): Validate status — sellers can only set 'active' or 'draft'
    const validStatuses = ['active', 'draft']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'status must be "active" or "draft"' },
        { status: 400 }
      )
    }

    // SECURITY: Sanitize user-generated text fields
    const name = sanitizeInput(body.name || '')
    const description = sanitizeInput(body.description || '')

    // SECURITY: Verify the authenticated user is a seller
    // Derive sellerId from the authenticated user, NOT from the request body.
    // This prevents the client from sending an empty/wrong sellerId that causes 403 errors
    // when the seller object hasn't loaded yet in the frontend Zustand store.
    let seller = await db.seller.findFirst({
      where: { userId: authResult.user.id },
    })

    // If the user doesn't have a seller record, they must register as seller first.
    // Auto-creation has been removed — it bypasses proper registration flow and
    // results in incomplete seller records (no bank info, no store description, etc.).
    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Akun seller belum terdaftar. Silakan daftar sebagai seller terlebih dahulu melalui menu profil.' },
        { status: 403 }
      )
    }

    // Use the server-derived seller ID (authoritative), not the client-provided one
    const verifiedSellerId = seller.id
    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'categoryId is required' },
        { status: 400 }
      )
    }

    // SECURITY (Fix 8): Validate that the category exists in the database
    const categoryExists = await db.category.findUnique({ where: { id: categoryId } })
    if (!categoryExists) {
      return NextResponse.json(
        { success: false, error: 'Kategori tidak ditemukan' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      )
    }
    if (!description) {
      return NextResponse.json(
        { success: false, error: 'description is required' },
        { status: 400 }
      )
    }
    if (price === undefined || price === null) {
      return NextResponse.json(
        { success: false, error: 'price is required' },
        { status: 400 }
      )
    }
    // SECURITY (Fix 4): Validate price is a positive number
    if (typeof price !== 'number' || price <= 0) {
      return NextResponse.json(
        { success: false, error: 'price harus berupa angka lebih dari 0' },
        { status: 400 }
      )
    }
    // SECURITY (Fix 4): Validate stock is >= 0
    if (stock !== undefined && stock !== null && (typeof stock !== 'number' || stock < 0)) {
      return NextResponse.json(
        { success: false, error: 'stock harus >= 0' },
        { status: 400 }
      )
    }
    // SECURITY (Fix 4): Validate weight is >= 0
    if (weight !== undefined && weight !== null && (typeof weight !== 'number' || weight < 0)) {
      return NextResponse.json(
        { success: false, error: 'weight harus >= 0' },
        { status: 400 }
      )
    }
    // SECURITY (Fix 4): Validate minOrder is >= 1
    if (minOrder !== undefined && minOrder !== null && (typeof minOrder !== 'number' || minOrder < 1)) {
      return NextResponse.json(
        { success: false, error: 'minOrder harus >= 1' },
        { status: 400 }
      )
    }
    // Weight is required for physical products, optional for jasa (service) products
    if (!isJasa && (weight === undefined || weight === null)) {
      return NextResponse.json(
        { success: false, error: 'Berat produk wajib diisi untuk produk barang' },
        { status: 400 }
      )
    }

    // SECURITY (Fix 5): Validate discountPrice < price
    if (discountPrice !== undefined && discountPrice !== null && discountPrice !== '' && typeof discountPrice === 'number' && discountPrice >= price) {
      return NextResponse.json(
        { success: false, error: 'Harga diskon harus lebih rendah dari harga jual' },
        { status: 400 }
      )
    }

    // Generate slug if not provided
    const productSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    // Check slug uniqueness
    const existingSlug = await db.product.findUnique({ where: { slug: productSlug } })
    if (existingSlug) {
      return NextResponse.json(
        { success: false, error: 'Product slug already exists' },
        { status: 409 }
      )
    }

    // Stringify JSON fields for storage
    // SECURITY: Filter out blob: URLs that can never be served to other users
    let safeImages = Array.isArray(images)
      ? images.filter((url: string) => typeof url === 'string' && !url.startsWith('blob:'))
      : images

    // SECURITY (Fix 6): Validate image URLs and max count
    if (Array.isArray(safeImages)) {
      const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null
      const validatedImages: string[] = []
      for (const url of safeImages) {
        try {
          const parsed = new URL(url)
          // Allow only https URLs from Supabase domain or valid https URLs
          if (parsed.protocol === 'https:') {
            validatedImages.push(url)
          } else if (supabaseHost && parsed.hostname === supabaseHost) {
            validatedImages.push(url)
          }
          // Reject http:, ftp:, etc.
        } catch {
          // Invalid URL, skip
        }
      }
      safeImages = validatedImages

      if (safeImages.length > UPLOAD_LIMITS.MAX_PRODUCT_IMAGES) {
        return NextResponse.json(
          { success: false, error: `Maksimal ${UPLOAD_LIMITS.MAX_PRODUCT_IMAGES} gambar per produk` },
          { status: 400 }
        )
      }
    }

    const imagesStr = typeof safeImages === 'string' ? safeImages : JSON.stringify(safeImages || [])
    const tagsStr = typeof tags === 'string' ? tags : (tags ? JSON.stringify(tags) : null)
    // SECURITY: Block blob: video URLs
    const safeVideoUrl = (typeof videoUrl === 'string' && !videoUrl.startsWith('blob:')) ? videoUrl : null

    // SECURITY (Fix 7): Sanitize and validate variant fields
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null
    const sanitizedVariants = variants.map((v: {
      name: string
      value: string
      sku?: string | null
      price?: number | null
      stock?: number
      image?: string | null
    }) => {
      // Sanitize variant name and value
      const sanitizedName = sanitizeInput(v.name || '')
      const sanitizedValue = sanitizeInput(v.value || '')

      // Validate variant stock
      if (v.stock !== undefined && v.stock !== null && (typeof v.stock !== 'number' || v.stock < 0)) {
        throw new Error('Variant stock harus >= 0')
      }

      // Validate variant image URL (same rules as product images)
      let validatedImage: string | null = null
      if (v.image && typeof v.image === 'string' && !v.image.startsWith('blob:')) {
        try {
          const parsed = new URL(v.image)
          if (parsed.protocol === 'https:') {
            validatedImage = v.image
          } else if (supabaseHost && parsed.hostname === supabaseHost) {
            validatedImage = v.image
          }
        } catch {
          // Invalid URL, skip
        }
      }

      return {
        name: sanitizedName,
        value: sanitizedValue,
        sku: v.sku || null,
        // Fix v.price || null to properly handle price=0
        price: v.price !== undefined && v.price !== null ? v.price : null,
        stock: v.stock ?? 0,
        image: validatedImage,
      }
    })

    const product = await db.product.create({
      data: {
        sellerId: verifiedSellerId,
        categoryId,
        name,
        slug: productSlug,
        description,
        price,
        discountPrice: discountPrice != null && discountPrice !== '' ? discountPrice : null,
        images: imagesStr,
        videoUrl: safeVideoUrl || null,
        stock: isJasa ? 1 : (stock || 0), // Jasa products have unlimited stock
        minOrder,
        weight: isJasa ? null : (weight || 0),
        condition: isJasa ? 'new' : condition,
        productType,
        serviceDuration: isJasa ? (serviceDuration || null) : null,
        serviceLocation: isJasa ? (serviceLocation || null) : null,
        status,
        // SECURITY (Fix 2): Force admin-only fields to false/null regardless of client input
        isFeatured: false,
        isFlashSale: false,
        flashSaleEnd: null,
        tags: tagsStr,
        variants: {
          create: sanitizedVariants,
        },
      },
      include: {
        category: true,
        variants: true,
      },
    })

    // Update seller total products count
    await db.seller.update({
      where: { id: verifiedSellerId },
      data: { totalProducts: { increment: 1 } },
    })

    // Parse JSON fields in response
    const parsedProduct = {
      ...product,
      images: parseJsonField(product.images),
      tags: parseJsonField(product.tags),
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedProduct,
    }), { status: 201 })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Seller Products POST error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/seller/products - Update a product
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Rate limit: max 20 operations per minute
    const rateLimit = await sellerProductsLimiter.check(authResult.user.id)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const {
      productId,
      categoryId,
      slug,
      price,
      discountPrice,
      images,
      videoUrl,
      stock,
      minOrder,
      weight,
      condition,
      productType,
      serviceDuration,
      serviceLocation,
      status,
      // SECURITY (Fix 2): isFeatured, isFlashSale, flashSaleEnd are admin-only fields.
      // We destructure them to remove from body but ignore the values.
      isFeatured: _isFeatured,
      isFlashSale: _isFlashSale,
      flashSaleEnd: _flashSaleEnd,
      tags,
      variants,
    } = body

    // SECURITY: Sanitize user-generated text fields
    const name = body.name !== undefined ? sanitizeInput(body.name) : undefined
    const description = body.description !== undefined ? sanitizeInput(body.description) : undefined

    // Validate required productId
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    // Validate numeric fields if provided
    if (price !== undefined && price !== null && (typeof price !== 'number' || price <= 0)) {
      return NextResponse.json(
        { success: false, error: 'price harus berupa angka lebih dari 0' },
        { status: 400 }
      )
    }
    if (discountPrice !== undefined && discountPrice !== null && discountPrice < 0) {
      return NextResponse.json(
        { success: false, error: 'discountPrice must be >= 0' },
        { status: 400 }
      )
    }
    if (stock !== undefined && stock !== null && (typeof stock !== 'number' || stock < 0)) {
      return NextResponse.json(
        { success: false, error: 'stock must be >= 0' },
        { status: 400 }
      )
    }
    if (minOrder !== undefined && minOrder !== null && (typeof minOrder !== 'number' || minOrder < 1)) {
      return NextResponse.json(
        { success: false, error: 'minOrder must be >= 1' },
        { status: 400 }
      )
    }
    if (weight !== undefined && weight !== null && (typeof weight !== 'number' || weight < 0)) {
      return NextResponse.json(
        { success: false, error: 'weight must be >= 0' },
        { status: 400 }
      )
    }

    // Validate productType if provided
    if (productType !== undefined && !['product', 'jasa'].includes(productType)) {
      return NextResponse.json(
        { success: false, error: 'productType must be "product" or "jasa"' },
        { status: 400 }
      )
    }

    // Validate condition if provided
    if (condition !== undefined && !['new', 'used'].includes(condition)) {
      return NextResponse.json(
        { success: false, error: 'condition must be "new" or "used"' },
        { status: 400 }
      )
    }

    // Validate status if provided
    if (status !== undefined && !['active', 'draft'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'status must be "active" or "draft"' },
        { status: 400 }
      )
    }

    // Fetch the product and verify ownership
    const existingProduct = await db.product.findUnique({
      where: { id: productId },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the product belongs to the authenticated seller
    // Find the seller record for this user
    const seller = await db.seller.findFirst({
      where: { userId: authResult.user.id },
    })

    if (!seller || existingProduct.sellerId !== seller.id) {
      return NextResponse.json(
        { success: false, error: 'Anda hanya dapat mengedit produk milik toko Anda sendiri' },
        { status: 403 }
      )
    }

    // SECURITY (Fix 5): Validate discountPrice < price
    // Use the provided price, or fall back to the existing product's price for comparison
    const effectivePrice = price ?? existingProduct.price
    if (discountPrice !== undefined && discountPrice !== null && discountPrice !== '' && typeof discountPrice === 'number' && discountPrice >= Number(effectivePrice)) {
      return NextResponse.json(
        { success: false, error: 'Harga diskon harus lebih rendah dari harga jual' },
        { status: 400 }
      )
    }

    // If slug is being updated, check uniqueness
    if (slug && slug !== existingProduct.slug) {
      const existingSlug = await db.product.findUnique({ where: { slug } })
      if (existingSlug) {
        return NextResponse.json(
          { success: false, error: 'Product slug already exists' },
          { status: 409 }
        )
      }
    }

    // Build update data object with only provided fields
    const updateData: Record<string, unknown> = {}

    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug
    if (description !== undefined) updateData.description = description
    if (price !== undefined) updateData.price = price
    if (discountPrice !== undefined) updateData.discountPrice = discountPrice != null && discountPrice !== '' ? discountPrice : null
    // SECURITY: Block blob: video URLs
    if (videoUrl !== undefined) updateData.videoUrl = (typeof videoUrl === 'string' && !videoUrl.startsWith('blob:')) ? videoUrl : null
    if (stock !== undefined) updateData.stock = stock
    if (minOrder !== undefined) updateData.minOrder = minOrder
    if (weight !== undefined) updateData.weight = weight
    if (condition !== undefined) updateData.condition = condition
    if (productType !== undefined) updateData.productType = productType
    if (serviceDuration !== undefined) updateData.serviceDuration = serviceDuration || null
    if (serviceLocation !== undefined) updateData.serviceLocation = serviceLocation || null
    // SECURITY (Fix 2): Do NOT allow seller to change isFeatured or isFlashSale — admin-only fields
    // These fields are intentionally omitted from updateData
    // if (isFeatured !== undefined) updateData.isFeatured = isFeatured
    // if (isFlashSale !== undefined) updateData.isFlashSale = isFlashSale
    // if (flashSaleEnd !== undefined) updateData.flashSaleEnd = flashSaleEnd ? new Date(flashSaleEnd) : null

    // Stringify JSON fields for storage
    // SECURITY: Filter out blob: URLs and validate image URLs (Fix 6)
    if (images !== undefined) {
      let safeImages = Array.isArray(images)
        ? images.filter((url: string) => typeof url === 'string' && !url.startsWith('blob:'))
        : images

      // SECURITY (Fix 6): Validate image URLs and max count
      if (Array.isArray(safeImages)) {
        const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null
        const validatedImages: string[] = []
        for (const url of safeImages) {
          try {
            const parsed = new URL(url)
            if (parsed.protocol === 'https:') {
              validatedImages.push(url)
            } else if (supabaseHost && parsed.hostname === supabaseHost) {
              validatedImages.push(url)
            }
          } catch {
            // Invalid URL, skip
          }
        }
        safeImages = validatedImages

        if (safeImages.length > UPLOAD_LIMITS.MAX_PRODUCT_IMAGES) {
          return NextResponse.json(
            { success: false, error: `Maksimal ${UPLOAD_LIMITS.MAX_PRODUCT_IMAGES} gambar per produk` },
            { status: 400 }
          )
        }
      }

      updateData.images = typeof safeImages === 'string' ? safeImages : JSON.stringify(safeImages || [])
    }
    if (tags !== undefined) {
      updateData.tags = typeof tags === 'string' ? tags : (tags ? JSON.stringify(tags) : null)
    }

    // Track status change for seller totalProducts update
    const oldStatus = existingProduct.status
    const newStatus = status !== undefined ? status : oldStatus
    const becameActive = oldStatus !== 'active' && newStatus === 'active'
    const leftActive = oldStatus === 'active' && newStatus !== 'active'

    // Handle variants update: delete existing and create new ones
    if (variants !== undefined) {
      // SECURITY (Fix 7): Sanitize and validate variant fields
      const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null
      const sanitizedVariants = variants.map((v: {
        name: string
        value: string
        sku?: string | null
        price?: number | null
        stock?: number
        image?: string | null
      }) => {
        // Sanitize variant name and value
        const sanitizedName = sanitizeInput(v.name || '')
        const sanitizedValue = sanitizeInput(v.value || '')

        // Validate variant stock
        if (v.stock !== undefined && v.stock !== null && (typeof v.stock !== 'number' || v.stock < 0)) {
          throw new Error('Variant stock harus >= 0')
        }

        // Validate variant image URL
        let validatedImage: string | null = null
        if (v.image && typeof v.image === 'string' && !v.image.startsWith('blob:')) {
          try {
            const parsed = new URL(v.image)
            if (parsed.protocol === 'https:') {
              validatedImage = v.image
            } else if (supabaseHost && parsed.hostname === supabaseHost) {
              validatedImage = v.image
            }
          } catch {
            // Invalid URL, skip
          }
        }

        return {
          name: sanitizedName,
          value: sanitizedValue,
          sku: v.sku || null,
          price: v.price !== undefined && v.price !== null ? v.price : null,
          stock: v.stock ?? 0,
          image: validatedImage,
        }
      })

      // Use a transaction to ensure atomicity
      const updatedProduct = await db.$transaction(async (tx) => {
        // Delete existing variants
        await tx.productVariant.deleteMany({
          where: { productId },
        })

        // Update product with new data and create new variants
        const product = await tx.product.update({
          where: { id: productId },
          data: {
            ...updateData,
            status: status !== undefined ? status : undefined,
            variants: {
              create: sanitizedVariants,
            },
          },
          include: {
            category: true,
            variants: true,
          },
        })

        // Update seller totalProducts count if status changed to/from active
        if (becameActive) {
          await tx.seller.update({
            where: { id: seller.id },
            data: { totalProducts: { increment: 1 } },
          })
        } else if (leftActive) {
          await tx.seller.update({
            where: { id: seller.id },
            data: { totalProducts: { decrement: 1 } },
          })
        }

        return product
      })

      // Parse JSON fields in response
      const parsedProduct = {
        ...updatedProduct,
        images: parseJsonField(updatedProduct.images),
        tags: parseJsonField(updatedProduct.tags),
      }

      return NextResponse.json(serializeDecimal({
        success: true,
        data: parsedProduct,
      }))
    }

    // No variants update - simpler path without transaction
    const updatedProduct = await db.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: productId },
        data: {
          ...updateData,
          status: status !== undefined ? status : undefined,
        },
        include: {
          category: true,
          variants: true,
        },
      })

      // Update seller totalProducts count if status changed to/from active
      if (becameActive) {
        await tx.seller.update({
          where: { id: seller.id },
          data: { totalProducts: { increment: 1 } },
        })
      } else if (leftActive) {
        await tx.seller.update({
          where: { id: seller.id },
          data: { totalProducts: { decrement: 1 } },
        })
      }

      return product
    })

    // Parse JSON fields in response
    const parsedProduct = {
      ...updatedProduct,
      images: parseJsonField(updatedProduct.images),
      tags: parseJsonField(updatedProduct.tags),
    }

    return NextResponse.json(serializeDecimal({
      success: true,
      data: parsedProduct,
    }))
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Seller Products PUT error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/seller/products - Soft delete a product (set status to 'blocked')
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Rate limit: max 20 operations per minute
    const rateLimit = await sellerProductsLimiter.check(authResult.user.id)
    if (!rateLimit.allowed) {
      const retrySeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${retrySeconds > 60 ? Math.ceil(retrySeconds / 60) + ' menit' : retrySeconds + ' detik'}.` },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { productId } = body

    // Validate required productId
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      )
    }

    // Fetch the product and verify ownership
    const existingProduct = await db.product.findUnique({
      where: { id: productId },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the product belongs to the authenticated seller
    const seller = await db.seller.findFirst({
      where: { userId: authResult.user.id },
    })

    if (!seller || existingProduct.sellerId !== seller.id) {
      return NextResponse.json(
        { success: false, error: 'Anda hanya dapat menghapus produk milik toko Anda sendiri' },
        { status: 403 }
      )
    }

    // Check if already soft-deleted
    if (existingProduct.status === 'blocked') {
      return NextResponse.json(
        { success: false, error: 'Product is already deleted' },
        { status: 400 }
      )
    }

    // Soft delete: set status to 'blocked' and decrement seller totalProducts if was active
    const wasActive = existingProduct.status === 'active'

    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { status: 'blocked' },
      })

      // Decrement seller totalProducts count only if product was active
      if (wasActive) {
        await tx.seller.update({
          where: { id: seller.id },
          data: { totalProducts: { decrement: 1 } },
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: { productId, status: 'blocked' },
    })
  } catch (error: unknown) {
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Seller Products DELETE error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
