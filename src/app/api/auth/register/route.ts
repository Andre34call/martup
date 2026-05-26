import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, generateAuthToken } from '@/lib/auth-middleware'
import bcrypt from 'bcryptjs'

import { logger } from '@/lib/logger'
// POST /api/auth/register - Register a new user with email and password
export async function POST(request: NextRequest) {
  try {
    // Rate limit check - stricter for register (3 per minute per IP)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`register:${clientIp}`)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan registrasi. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email, phone, password } = body

    // Validate required fields
    if (!name || name.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Nama minimal 3 karakter' },
        { status: 400 }
      )
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Format email tidak valid' },
        { status: 400 }
      )
    }

    if (!password || password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { success: false, error: 'Password minimal 8 karakter, harus mengandung huruf dan angka' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email sudah terdaftar. Silakan login.' },
        { status: 409 }
      )
    }

    // Hash password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Create user - ALWAYS as buyer (NEVER admin)
    const user = await db.user.create({
      data: {
        email,
        name,
        phone: phone || null,
        password: hashedPassword,
        role: 'buyer', // ALWAYS buyer - admin must be promoted via /api/admin/setup
        isVerified: false, // Email verification needed
        wallet: {
          create: {
            balance: 0,
            holdBalance: 0,
          },
        },
      },
      include: {
        seller: true,
        wallet: true,
      },
    })

    // Generate auth token
    const token = generateAuthToken(user.id)

    // Create welcome notification
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Selamat Datang di MartUp! 🎉',
        content: 'Terima kasih telah bergabung. Mulai belanja atau jual produk sekarang!',
        type: 'system',
        isRead: false,
      },
    })

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      token,
      message: 'Registrasi berhasil! Selamat datang di MartUp.',
    })
  } catch (error: any) {
    logger.error({ err: error }, 'Register error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
