// ==================== CENTRALIZED ORDER NOTIFICATIONS ====================
// Single entry point for all order/complaint/refund notifications.
// Handles: in-app notification, email (if enabled), push (if FCM available).
// All external notifications are fire-and-forget (non-blocking).

import { db } from './db'
import { logger } from './logger'
import { sendEmail } from './email'
import { sendPushNotification } from './push-notification'
import {
  orderConfirmedTemplate,
  orderShippedTemplate,
  orderDeliveredTemplate,
  orderCancelledTemplate,
  refundStatusTemplate,
  type OrderEmailData,
  type ComplaintEmailData,
} from './email-templates'

// ─── Notification Types ───

export type OrderNotificationType =
  | 'order_confirmed'     // paid/processing
  | 'order_processing'    // seller marks as processing
  | 'order_shipped'       // seller ships with tracking
  | 'order_delivered'     // buyer confirms delivery
  | 'order_cancelled'     // order cancelled
  | 'refund_status'       // complaint/refund status changed
  | 'review_reply'        // seller replied to review

// ─── In-App Notification Map ───

const NOTIFICATION_TEMPLATES: Record<string, {
  title: string
  content: string
  type: string  // notification type in DB: order, system, etc.
  refType: string
}> = {
  order_confirmed: {
    title: 'Pembayaran Berhasil',
    content: 'Pembayaran untuk pesanan {orderNumber} telah dikonfirmasi.',
    type: 'order',
    refType: 'order',
  },
  order_processing: {
    title: 'Pesanan Sedang Diproses',
    content: 'Pesanan {orderNumber} sedang diproses oleh penjual.',
    type: 'order',
    refType: 'order',
  },
  order_shipped: {
    title: 'Pesanan Dikirim',
    content: 'Pesanan {orderNumber} telah dikirim. Nomor resi: {trackingNumber}.',
    type: 'order',
    refType: 'order',
  },
  order_delivered: {
    title: 'Pesanan Diterima',
    content: 'Pesanan {orderNumber} telah dikonfirmasi diterima. Dana penjual telah dicairkan.',
    type: 'order',
    refType: 'order',
  },
  order_cancelled: {
    title: 'Pesanan Dibatalkan',
    content: 'Pesanan {orderNumber} telah dibatalkan. Alasan: {reason}',
    type: 'order',
    refType: 'order',
  },
  refund_status: {
    title: 'Status Pengembalian Diperbarui',
    content: 'Pengajuan untuk pesanan {orderNumber} statusnya menjadi {status}.',
    type: 'order',
    refType: 'complaint',
  },
  review_reply: {
    title: 'Penjual Membalas Review',
    content: 'Penjual telah membalas review Anda untuk produk "{productName}".',
    type: 'system',
    refType: 'review',
  },
}

// ─── Seller Notification Map (for order events) ───

const SELLER_NOTIFICATION_TEMPLATES: Record<string, {
  title: string
  content: string
}> = {
  order_confirmed: {
    title: 'Pesanan Baru Dibayar',
    content: 'Pesanan {orderNumber} telah dibayar. Segera proses pesanan!',
  },
  order_processing: {
    title: 'Pesanan Diproses',
    content: 'Pesanan {orderNumber} telah Anda tandai sebagai diproses.',
  },
  order_shipped: {
    title: 'Pesanan Dikirim',
    content: 'Pesanan {orderNumber} telah Anda tandai sebagai dikirim. Nomor resi: {trackingNumber}.',
  },
  order_delivered: {
    title: 'Dana Pesanan Dicairkan',
    content: 'Pembeli telah mengkonfirmasi penerimaan pesanan {orderNumber}. Dana telah dicairkan ke saldo Anda.',
  },
  order_cancelled: {
    title: 'Pesanan Dibatalkan',
    content: 'Pesanan {orderNumber} telah dibatalkan. Alasan: {reason}',
  },
}

// ─── Check user email notification preference ───

async function isEmailNotifEnabled(userId: string): Promise<boolean> {
  try {
    const setting = await db.userSetting.findUnique({
      where: { userId_key: { userId, key: 'emailNotif' } },
    })
    if (!setting) return true // Default is enabled
    return JSON.parse(setting.value) as boolean
  } catch {
    return true
  }
}

// ─── Main: Send Order Notification ───

interface OrderNotificationParams {
  userId: string
  type: OrderNotificationType
  data: {
    orderNumber?: string
    orderId?: string
    trackingNumber?: string
    cancelReason?: string
    // For order emails
    orderData?: OrderEmailData
    // For complaint/refund emails
    complaintData?: ComplaintEmailData
    // For review reply
    productName?: string
    reviewId?: string
    // Seller to notify (for order events)
    sellerUserId?: string
    complaintId?: string
    complaintStatus?: string
  }
}

/**
 * Centralized notification sender for order/complaint/refund events.
 *
 * 1. Creates in-app notification via DB
 * 2. Checks user's emailNotif preference → sends email if enabled
 * 3. Sends push notification via FCM (if token exists)
 *
 * All email/push sending is non-blocking (fire-and-forget).
 */
export async function sendOrderNotification(params: OrderNotificationParams): Promise<void> {
  const { userId, type, data } = params

  try {
    // Step 1: Create in-app notification
    const template = NOTIFICATION_TEMPLATES[type]
    if (template) {
      const content = template.content
        .replace('{orderNumber}', data.orderNumber || '')
        .replace('{trackingNumber}', data.trackingNumber || '-')
        .replace('{reason}', data.cancelReason || '-')
        .replace('{status}', data.complaintStatus || '-')
        .replace('{productName}', data.productName || '')

      await db.notification.create({
        data: {
          userId,
          title: template.title,
          content,
          type: template.type,
          refType: template.refType,
          refId: data.orderId || data.complaintId || data.reviewId || null,
        },
      }).catch(err => {
        logger.warn({ component: 'order-notifications', err, type, userId }, 'Failed to create in-app notification (non-fatal)')
      })
    }

    // Step 2: Also notify seller for order events
    if (data.sellerUserId && SELLER_NOTIFICATION_TEMPLATES[type]) {
      const sellerTemplate = SELLER_NOTIFICATION_TEMPLATES[type]
      const sellerContent = sellerTemplate.content
        .replace('{orderNumber}', data.orderNumber || '')
        .replace('{trackingNumber}', data.trackingNumber || '-')
        .replace('{reason}', data.cancelReason || '-')

      await db.notification.create({
        data: {
          userId: data.sellerUserId,
          title: sellerTemplate.title,
          content: sellerContent,
          type: 'order',
          refType: 'order',
          refId: data.orderId || null,
        },
      }).catch(err => {
        logger.warn({ component: 'order-notifications', err, type, sellerUserId: data.sellerUserId }, 'Failed to create seller in-app notification (non-fatal)')
      })
    }

    // Step 3: Send email notification (non-blocking)
    sendEmailNotification(userId, type, data).catch(() => {
      // Already logged inside the function
    })

    // Step 4: Send push notification (non-blocking)
    sendPushForNotification(userId, type, data).catch(() => {
      // Already logged inside the function
    })

    // Also push to seller for order events
    if (data.sellerUserId && SELLER_NOTIFICATION_TEMPLATES[type]) {
      const sellerTemplate = SELLER_NOTIFICATION_TEMPLATES[type]
      const sellerTitle = sellerTemplate.title
      sendPushNotification({
        userId: data.sellerUserId,
        title: sellerTitle,
        body: `Pesanan #${data.orderNumber || ''}`,
        data: { type: 'order', orderId: data.orderId || '', status: type },
      }).catch(() => {
        // Already logged inside push-notification.ts
      })
    }
  } catch (error) {
    logger.warn({ component: 'order-notifications', err: error, type, userId }, 'sendOrderNotification error (non-fatal)')
  }
}

// ─── Email Notification Sub-handler ───

async function sendEmailNotification(
  userId: string,
  type: OrderNotificationType,
  data: OrderNotificationParams['data']
): Promise<void> {
  try {
    // Check email preference
    const emailEnabled = await isEmailNotifEnabled(userId)
    if (!emailEnabled) return

    // Get user email
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    if (!user?.email) return

    let subject = ''
    let html = ''

    switch (type) {
      case 'order_confirmed':
      case 'order_processing': {
        if (!data.orderData) return
        const template = orderConfirmedTemplate({
          ...data.orderData,
          userName: user.name || 'Pembeli',
          userEmail: user.email,
        })
        subject = template.subject
        html = template.html
        break
      }
      case 'order_shipped': {
        if (!data.orderData) return
        const template = orderShippedTemplate({
          ...data.orderData,
          userName: user.name || 'Pembeli',
          userEmail: user.email,
        }, data.trackingNumber)
        subject = template.subject
        html = template.html
        break
      }
      case 'order_delivered': {
        if (!data.orderData) return
        const template = orderDeliveredTemplate({
          ...data.orderData,
          userName: user.name || 'Pembeli',
          userEmail: user.email,
        })
        subject = template.subject
        html = template.html
        break
      }
      case 'order_cancelled': {
        if (!data.orderData) return
        const template = orderCancelledTemplate({
          ...data.orderData,
          userName: user.name || 'Pembeli',
          userEmail: user.email,
        }, data.cancelReason)
        subject = template.subject
        html = template.html
        break
      }
      case 'refund_status': {
        if (!data.complaintData) return
        const template = refundStatusTemplate({
          ...data.complaintData,
          userName: user.name || 'Pembeli',
          userEmail: user.email,
        })
        subject = template.subject
        html = template.html
        break
      }
      case 'review_reply': {
        // Review reply uses a simpler email
        subject = `Penjual Membalas Review Anda — ${data.productName || 'Produk'}`
        html = buildReviewReplyEmail(user.name || 'Pembeli', data.productName || 'Produk')
        break
      }
      default:
        return
    }

    await sendEmail({ to: user.email, subject, html })
    logger.info({ component: 'order-notifications', type, userId }, 'Email notification sent')
  } catch (error) {
    logger.warn({ component: 'order-notifications', err: error, type, userId }, 'Email notification failed (non-fatal)')
  }
}

// ─── Push Notification Sub-handler ───

async function sendPushForNotification(
  userId: string,
  type: OrderNotificationType,
  data: OrderNotificationParams['data']
): Promise<void> {
  try {
    const template = NOTIFICATION_TEMPLATES[type]
    if (!template) return

    const body = template.content
      .replace('{orderNumber}', data.orderNumber || '')
      .replace('{trackingNumber}', data.trackingNumber || '-')
      .replace('{reason}', data.cancelReason || '-')
      .replace('{status}', data.complaintStatus || '-')
      .replace('{productName}', data.productName || '')

    await sendPushNotification({
      userId,
      title: template.title,
      body,
      data: {
        type: template.type,
        ...(data.orderId ? { orderId: data.orderId } : {}),
        ...(data.complaintId ? { complaintId: data.complaintId } : {}),
        ...(data.reviewId ? { reviewId: data.reviewId } : {}),
      },
    })
  } catch (error) {
    logger.warn({ component: 'order-notifications', err: error, type, userId }, 'Push notification failed (non-fatal)')
  }
}

// ─── Simple Review Reply Email ───

function buildReviewReplyEmail(userName: string, productName: string): string {
  const BASE_URL = process.env.NEXTAUTH_URL || 'https://martup-seven.vercel.app'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <tr>
      <td style="background:linear-gradient(135deg,#10b981,#14b8a6);padding:32px;text-align:center">
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px">MartUp</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px">Review Reply</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px">
        <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;font-weight:700">Halo ${userName}! 💬</h2>
        <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6">
          Penjual telah membalas review Anda untuk produk <strong>"${productName}"</strong>.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
          <tr>
            <td align="center">
              <a href="${BASE_URL}/orders" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#10b981,#14b8a6);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.3px">
                Lihat Review Saya
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
        <p style="margin:0;color:#d1d5db;font-size:11px;text-align:center">
          &copy; ${new Date().getFullYear()} MartUp. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}
