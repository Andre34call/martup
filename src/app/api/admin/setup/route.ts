import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/admin/setup - Create the first admin user using a setup secret
// This endpoint does NOT require authentication (it's used before any admin exists)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, secret } = body

    if (!email || !secret) {
      return NextResponse.json(
        { success: false, error: 'email and secret are required' },
        { status: 400 }
      )
    }

    // Verify the setup secret
    const validSecret = process.env.ADMIN_SETUP_SECRET || 'martup-admin-2024'
    if (secret !== validSecret) {
      return NextResponse.json(
        { success: false, error: 'Invalid setup secret' },
        { status: 403 }
      )
    }

    // Find the user by email
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found with this email' },
        { status: 404 }
      )
    }

    // Check if user is already an admin
    if (user.role === 'admin') {
      return NextResponse.json(
        { success: false, error: 'User is already an admin' },
        { status: 400 }
      )
    }

    // Promote the user to admin
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { role: 'admin' },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
      message: `User ${updatedUser.name} has been promoted to admin`,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin setup POST error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
