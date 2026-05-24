import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/admin/setup - Promote a user to admin role
// Body: { email: string, secret: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, secret } = body

    // Validate secret - use env var or fallback
    const adminSecret = process.env.ADMIN_SETUP_SECRET || 'martup-admin-2024'
    if (secret !== adminSecret) {
      return NextResponse.json(
        { success: false, error: 'Invalid secret key' },
        { status: 403 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
      include: { seller: true, wallet: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: `User with email "${email}" not found. Please register/login first, then promote to admin.` },
        { status: 404 }
      )
    }

    // Already admin?
    if (user.role === 'admin') {
      return NextResponse.json({
        success: true,
        message: 'User is already an admin',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified,
        },
      })
    }

    // Promote to admin
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        role: 'admin',
        isVerified: true,
      },
    })

    // Create welcome notification
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Selamat! Anda sekarang Admin 🎉',
        content: 'Akun Anda telah dipromosikan menjadi Admin MartUp. Anda sekarang memiliki akses ke panel admin lengkap.',
        type: 'system',
        isRead: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: `User "${email}" has been promoted to admin successfully!`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Admin setup error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
