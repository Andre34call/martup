import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import { clearSessionCookies } from '@/lib/session-cookie'
import bcrypt from 'bcryptjs'

// DELETE /api/user/delete - Delete the authenticated user's account
export async function DELETE(request: NextRequest) {
  try {
    // Verify the user is authenticated
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const userId = authResult.user.id

    // SECURITY: Require password confirmation before deleting account
    const body = await request.json()
    const { password } = body as { password?: string }

    // Get user with password for verification
    const userWithPassword = await db.user.findUnique({
      where: { id: userId },
      select: { password: true },
    })

    if (userWithPassword?.password) {
      // User has a password - require it
      if (!password) {
        return NextResponse.json({ success: false, error: 'Password wajib diisi untuk menghapus akun' }, { status: 400 })
      }
      const isValid = await bcrypt.compare(password, userWithPassword.password)
      if (!isValid) {
        return NextResponse.json({ success: false, error: 'Password salah' }, { status: 401 })
      }
    } else {
      // OAuth-only user - require confirmation phrase
      if (password !== 'DELETE') {
        return NextResponse.json({ success: false, error: 'Ketik "DELETE" untuk mengkonfirmasi penghapusan akun' }, { status: 400 })
      }
    }

    // Invalidate all existing tokens before deleting
    await db.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    })

    // Wrap all deletions in a single transaction for atomicity
    await db.$transaction(async (tx) => {
      // 1. Delete chat messages
      await tx.chatMessage.deleteMany({ where: { senderId: userId } })

      // 2. Delete chat participants
      await tx.chatParticipant.deleteMany({ where: { userId } })

      // 3. Delete notifications
      await tx.notification.deleteMany({ where: { userId } })

      // 4. Delete addresses
      await tx.address.deleteMany({ where: { userId } })

      // 5. Delete reviews
      await tx.review.deleteMany({ where: { userId } })

      // 6. Delete wishlist items
      await tx.wishlist.deleteMany({ where: { userId } })

      // 7. Delete cart items
      await tx.cartItem.deleteMany({ where: { userId } })

      // 8. Delete transactions
      await tx.transaction.deleteMany({ where: { userId } })

      // 9. Delete deposits
      await tx.deposit.deleteMany({ where: { userId } })

      // 10. Delete referrals
      await tx.referral.deleteMany({ where: { referrerId: userId } })

      // 10b. Clear work item assignments (don't delete the work items, just unassign)
      await tx.workItem.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } })

      // 10c. Clear division head if user is a division head
      await tx.division.updateMany({ where: { headUserId: userId }, data: { headUserId: null } })

      // 11. Delete order items (via orders)
      const userOrders = await tx.order.findMany({
        where: { userId },
        select: { id: true },
      })
      if (userOrders.length > 0) {
        const orderIds = userOrders.map(o => o.id)
        await tx.voucherUsage.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.complaint.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.shipping.deleteMany({ where: { orderId: { in: orderIds } } })
        await tx.order.deleteMany({ where: { id: { in: orderIds } } })
      }

      // 12. Delete wallet mutations and wallet
      await tx.walletMutation.deleteMany({ where: { wallet: { userId } } })
      await tx.wallet.deleteMany({ where: { userId } })

      // 13. Delete seller-related data if user is a seller
      const seller = await tx.seller.findUnique({ where: { userId } })
      if (seller) {
        // Delete seller's products, orders, etc.
        const sellerProducts = await tx.product.findMany({
          where: { sellerId: seller.id },
          select: { id: true },
        })
        if (sellerProducts.length > 0) {
          const productIds = sellerProducts.map(p => p.id)
          await tx.review.deleteMany({ where: { productId: { in: productIds } } })
          await tx.productVariant.deleteMany({ where: { productId: { in: productIds } } })
          await tx.wishlist.deleteMany({ where: { productId: { in: productIds } } })
          await tx.cartItem.deleteMany({ where: { productId: { in: productIds } } })
          await tx.product.deleteMany({ where: { id: { in: productIds } } })
        }

        // Delete seller orders
        const sellerOrders = await tx.order.findMany({
          where: { sellerId: seller.id },
          select: { id: true },
        })
        if (sellerOrders.length > 0) {
          const sellerOrderIds = sellerOrders.map(o => o.id)
          await tx.orderItem.deleteMany({ where: { orderId: { in: sellerOrderIds } } })
          await tx.shipping.deleteMany({ where: { orderId: { in: sellerOrderIds } } })
          await tx.voucherUsage.deleteMany({ where: { orderId: { in: sellerOrderIds } } })
          await tx.complaint.deleteMany({ where: { orderId: { in: sellerOrderIds } } })
          await tx.order.deleteMany({ where: { id: { in: sellerOrderIds } } })
        }

        // Delete seller wallet
        await tx.walletMutation.deleteMany({ where: { wallet: { sellerId: seller.id } } })
        await tx.wallet.deleteMany({ where: { sellerId: seller.id } })

        // Delete seller
        await tx.seller.delete({ where: { userId } })
      }

      // 14. Delete followed stores
      await tx.followedStore.deleteMany({ where: { userId } })

      // 15. Delete user settings
      await tx.userSetting.deleteMany({ where: { userId } })

      // 16. Finally, delete the user
      await tx.user.delete({ where: { id: userId } })
    })

    logger.info({ component: 'auth', userId }, 'User account deleted successfully')

    const response = NextResponse.json({
      success: true,
      message: 'Akun berhasil dihapus.',
    })
    clearSessionCookies(response)
    return response
  } catch (error) {
    logger.error({ err: error }, 'Delete account error')
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus akun. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
