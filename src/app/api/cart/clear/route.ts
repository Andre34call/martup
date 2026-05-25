import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth, authErrorResponse, checkRateLimit } from '@/lib/auth-middleware'

// POST /api/cart/clear - Clear cart items (SECURED with verifyAuth)
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication — NO more x-user-id spoofing
    const authResult = await verifyAuth(request)
    if (!authResult.success) return authErrorResponse(authResult)

    const userId = authResult.user.id

    // Rate limit: 10 clear operations per minute per user
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`cart-clear:${clientIp}:${userId}`, 10)) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { itemIds } = body

    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      // SECURITY: Verify all items belong to this user before deleting
      const items = await db.cartItem.findMany({
        where: {
          id: { in: itemIds },
        },
        select: { id: true, userId: true },
      })

      const forbiddenItems = items.filter(item => item.userId !== userId)
      if (forbiddenItems.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Forbidden - Anda hanya bisa menghapus item dari keranjang sendiri' },
          { status: 403 }
        )
      }

      // Delete specific items (with userId check for extra safety)
      const result = await db.cartItem.deleteMany({
        where: {
          id: { in: itemIds },
          userId, // Extra safety: ensure we only delete user's items
        },
      })
      return NextResponse.json({
        success: true,
        message: `${result.count} item berhasil dihapus dari keranjang`,
      })
    }

    // Clear all items for this user only
    const result = await db.cartItem.deleteMany({
      where: { userId },
    })

    return NextResponse.json({
      success: true,
      message: `Keranjang berhasil dikosongkan (${result.count} item dihapus)`,
    })
  } catch (error) {
    console.error('Cart clear error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
