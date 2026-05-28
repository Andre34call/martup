import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAuth } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'

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

    // Delete in order of dependencies (child records first)
    // 1. Delete chat messages
    await db.chatMessage.deleteMany({ where: { senderId: userId } })

    // 2. Delete chat participants
    await db.chatParticipant.deleteMany({ where: { userId } })

    // 3. Delete notifications
    await db.notification.deleteMany({ where: { userId } })

    // 4. Delete addresses
    await db.address.deleteMany({ where: { userId } })

    // 5. Delete reviews
    await db.review.deleteMany({ where: { userId } })

    // 6. Delete wishlist items
    await db.wishlist.deleteMany({ where: { userId } })

    // 7. Delete cart items
    await db.cartItem.deleteMany({ where: { userId } })

    // 8. Delete transactions
    await db.transaction.deleteMany({ where: { userId } })

    // 9. Delete deposits
    await db.deposit.deleteMany({ where: { userId } })

    // 10. Delete referrals
    await db.referral.deleteMany({ where: { referrerId: userId } })

    // 10b. Clear work item assignments (don't delete the work items, just unassign)
    await db.workItem.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } })

    // 10c. Clear division head if user is a division head
    await db.division.updateMany({ where: { headUserId: userId }, data: { headUserId: null } })

    // 11. Delete order items (via orders)
    const userOrders = await db.order.findMany({
      where: { userId },
      select: { id: true },
    })
    if (userOrders.length > 0) {
      const orderIds = userOrders.map(o => o.id)
      await db.voucherUsage.deleteMany({ where: { orderId: { in: orderIds } } })
      await db.complaint.deleteMany({ where: { orderId: { in: orderIds } } })
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
      await db.shipping.deleteMany({ where: { orderId: { in: orderIds } } })
      await db.order.deleteMany({ where: { id: { in: orderIds } } })
    }

    // 12. Delete wallet mutations and wallet
    await db.walletMutation.deleteMany({ where: { wallet: { userId } } })
    await db.wallet.deleteMany({ where: { userId } })

    // 13. Delete seller-related data if user is a seller
    const seller = await db.seller.findUnique({ where: { userId } })
    if (seller) {
      // Delete seller's products, orders, etc.
      const sellerProducts = await db.product.findMany({
        where: { sellerId: seller.id },
        select: { id: true },
      })
      if (sellerProducts.length > 0) {
        const productIds = sellerProducts.map(p => p.id)
        await db.review.deleteMany({ where: { productId: { in: productIds } } })
        await db.productVariant.deleteMany({ where: { productId: { in: productIds } } })
        await db.wishlist.deleteMany({ where: { productId: { in: productIds } } })
        await db.product.deleteMany({ where: { id: { in: productIds } } })
      }

      // Delete seller orders
      const sellerOrders = await db.order.findMany({
        where: { sellerId: seller.id },
        select: { id: true },
      })
      if (sellerOrders.length > 0) {
        const sellerOrderIds = sellerOrders.map(o => o.id)
        await db.orderItem.deleteMany({ where: { orderId: { in: sellerOrderIds } } })
        await db.shipping.deleteMany({ where: { orderId: { in: sellerOrderIds } } })
        await db.order.deleteMany({ where: { id: { in: sellerOrderIds } } })
      }

      // Delete seller wallet
      await db.walletMutation.deleteMany({ where: { wallet: { sellerId: seller.id } } })
      await db.wallet.deleteMany({ where: { sellerId: seller.id } })

      // Delete seller
      await db.seller.delete({ where: { userId } })
    }

    // 14. Delete user settings
    await db.userSetting.deleteMany({ where: { userId } })

    // 15. Finally, delete the user
    await db.user.delete({ where: { id: userId } })

    logger.info({ component: 'auth', userId }, 'User account deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil dihapus.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Delete account error')
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus akun. Coba lagi nanti.' },
      { status: 500 }
    )
  }
}
