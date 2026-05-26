import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'

// ==================== VALIDATION HELPERS ====================

const MAX_ADDRESSES_PER_USER = 10

interface AddressBody {
  label?: string
  recipient?: string
  phone?: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  isDefault?: boolean
  addressId?: string
}

function validateIndonesianPhone(phone: string): boolean {
  // Strip non-digit chars (except leading +) for validation
  const digitsOnly = phone.replace(/[^\d+]/g, '')
  // Must start with 0 or +62, then 9-14 more digits (total 10-15 digits)
  const phoneRegex = /^(0\d{9,14}|\+62\d{9,14})$/
  return phoneRegex.test(digitsOnly)
}

function validatePostalCode(postalCode: string): boolean {
  return /^\d{5}$/.test(postalCode)
}

function validateCreateFields(body: AddressBody): string | null {
  const requiredFields: Array<{ key: keyof AddressBody; label: string }> = [
    { key: 'label', label: 'Label' },
    { key: 'recipient', label: 'Recipient' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'province', label: 'Province' },
    { key: 'postalCode', label: 'Postal code' },
  ]

  for (const field of requiredFields) {
    const value = body[field.key]
    if (!value || typeof value !== 'string' || !value.trim()) {
      return `${field.label} is required`
    }
  }

  // Length validations
  if (body.label!.length > 50) return 'Label must be at most 50 characters'
  if (body.recipient!.length > 100) return 'Recipient must be at most 100 characters'
  if (body.address!.length > 500) return 'Address must be at most 500 characters'
  if (body.city!.length > 100) return 'City must be at most 100 characters'
  if (body.province!.length > 100) return 'Province must be at most 100 characters'

  // Phone format validation (Indonesian: starts with 0 or +62, 10-15 digits)
  if (!validateIndonesianPhone(body.phone!)) {
    return 'Phone number must be a valid Indonesian number (starts with 0 or +62, 10-15 digits)'
  }

  // Postal code validation (5 digits only)
  if (!validatePostalCode(body.postalCode!)) {
    return 'Postal code must be exactly 5 digits'
  }

  return null
}

// ==================== GET /api/addresses ====================
// List all addresses for the authenticated user

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // SECURITY: Users can only access their own addresses
    if (userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only access your own addresses' },
        { status: 403 }
      )
    }

    const addresses = await db.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: addresses,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Addresses GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== POST /api/addresses ====================
// Add a new address

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    // Rate limit: 10/min
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`address-post:${clientIp}:${authResult.user.id}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again in 1 minute.' },
        { status: 429 }
      )
    }

    const body: AddressBody = await request.json()

    // Validate all required fields
    const validationError = validateCreateFields(body)
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      )
    }

    const userId = authResult.user.id

    // Check max addresses limit
    const addressCount = await db.address.count({
      where: { userId },
    })

    if (addressCount >= MAX_ADDRESSES_PER_USER) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_ADDRESSES_PER_USER} addresses allowed per user` },
        { status: 400 }
      )
    }

    const isDefault = body.isDefault ?? false

    // Use transaction to handle isDefault logic
    const address = await db.$transaction(async (tx) => {
      // If setting as default, unset all other defaults
      if (isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        })
      }

      // If this is the first address, force it to be default
      const shouldForceDefault = addressCount === 0

      const newAddress = await tx.address.create({
        data: {
          userId,
          label: body.label!.trim(),
          recipient: body.recipient!.trim(),
          phone: body.phone!.trim(),
          address: body.address!.trim(),
          city: body.city!.trim(),
          province: body.province!.trim(),
          postalCode: body.postalCode!.trim(),
          isDefault: shouldForceDefault || isDefault,
        },
      })

      return newAddress
    })

    return NextResponse.json(
      { success: true, data: address },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Addresses POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== PUT /api/addresses ====================
// Update an existing address

export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body: AddressBody & { addressId: string } = await request.json()
    const { addressId, label, recipient, phone, address, city, province, postalCode, isDefault } = body

    if (!addressId) {
      return NextResponse.json(
        { success: false, error: 'addressId is required' },
        { status: 400 }
      )
    }

    // Verify address belongs to auth user
    const existingAddress = await db.address.findUnique({
      where: { id: addressId },
    })

    if (!existingAddress) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      )
    }

    if (existingAddress.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only update your own addresses' },
        { status: 403 }
      )
    }

    // Validate provided fields
    if (label !== undefined && typeof label === 'string' && label.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Label must be at most 50 characters' },
        { status: 400 }
      )
    }
    if (recipient !== undefined && typeof recipient === 'string' && recipient.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Recipient must be at most 100 characters' },
        { status: 400 }
      )
    }
    if (address !== undefined && typeof address === 'string' && address.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Address must be at most 500 characters' },
        { status: 400 }
      )
    }
    if (city !== undefined && typeof city === 'string' && city.length > 100) {
      return NextResponse.json(
        { success: false, error: 'City must be at most 100 characters' },
        { status: 400 }
      )
    }
    if (province !== undefined && typeof province === 'string' && province.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Province must be at most 100 characters' },
        { status: 400 }
      )
    }

    // Phone format validation if provided
    if (phone !== undefined && phone !== null && phone !== '') {
      if (!validateIndonesianPhone(phone)) {
        return NextResponse.json(
          { success: false, error: 'Phone number must be a valid Indonesian number (starts with 0 or +62, 10-15 digits)' },
          { status: 400 }
        )
      }
    }

    // Postal code validation if provided
    if (postalCode !== undefined && postalCode !== null && postalCode !== '') {
      if (!validatePostalCode(postalCode)) {
        return NextResponse.json(
          { success: false, error: 'Postal code must be exactly 5 digits' },
          { status: 400 }
        )
      }
    }

    // Use transaction to handle isDefault logic
    const updatedAddress = await db.$transaction(async (tx) => {
      // If setting as default, unset all other defaults
      if (isDefault === true) {
        await tx.address.updateMany({
          where: { userId: authResult.user.id, isDefault: true },
          data: { isDefault: false },
        })
      }

      // Build update data with only provided fields
      const updateData: Record<string, unknown> = {}
      if (label !== undefined) updateData.label = label.trim()
      if (recipient !== undefined) updateData.recipient = recipient.trim()
      if (phone !== undefined) updateData.phone = phone.trim()
      if (address !== undefined) updateData.address = address.trim()
      if (city !== undefined) updateData.city = city.trim()
      if (province !== undefined) updateData.province = province.trim()
      if (postalCode !== undefined) updateData.postalCode = postalCode.trim()
      if (isDefault !== undefined) updateData.isDefault = isDefault

      const result = await tx.address.update({
        where: { id: addressId },
        data: updateData,
      })

      return result
    })

    return NextResponse.json({
      success: true,
      data: updatedAddress,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Addresses PUT error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// ==================== DELETE /api/addresses ====================
// Delete an address

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const body: { addressId?: string } = await request.json()
    const { addressId } = body

    if (!addressId) {
      return NextResponse.json(
        { success: false, error: 'addressId is required' },
        { status: 400 }
      )
    }

    // Verify address belongs to auth user
    const existingAddress = await db.address.findUnique({
      where: { id: addressId },
    })

    if (!existingAddress) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      )
    }

    if (existingAddress.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You can only delete your own addresses' },
        { status: 403 }
      )
    }

    // Use transaction for delete + default reassignment
    await db.$transaction(async (tx) => {
      await tx.address.delete({
        where: { id: addressId },
      })

      // If the deleted address was default, set the most recent remaining as default
      if (existingAddress.isDefault) {
        const mostRecent = await tx.address.findFirst({
          where: { userId: authResult.user.id },
          orderBy: { createdAt: 'desc' },
        })

        if (mostRecent) {
          await tx.address.update({
            where: { id: mostRecent.id },
            data: { isDefault: true },
          })
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Addresses DELETE error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
