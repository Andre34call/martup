import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, avatar, provider, providerAccountId } = body

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 })
    }

    // Check if user exists
    let user = await db.user.findUnique({
      where: { email },
      include: {
        seller: true,
        wallet: true,
      },
    })

    if (!user) {
      // Create new user - CLEAN SLATE (no orders, no notifications, no products)
      user = await db.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          avatar: avatar || null,
          role: 'buyer',
          isVerified: false,
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

      // Welcome notification for new users
      await db.notification.create({
        data: {
          userId: user.id,
          title: 'Selamat Datang di MartUp! 🎉',
          content: 'Terima kasih telah bergabung. Mulai belanja atau jual produk sekarang!',
          type: 'system',
          isRead: false,
        },
      })
    } else {
      // Update existing user info from Google
      if (name && name !== user.name) {
        await db.user.update({
          where: { id: user.id },
          data: { name, avatar: avatar || user.avatar },
        })
      }
    }

    // Fetch updated user with all relations
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        seller: true,
        wallet: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: fullUser,
      isNewUser: !user.wallet || user.createdAt === user.updatedAt,
    })
  } catch (error: any) {
    console.error('Sync user error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
