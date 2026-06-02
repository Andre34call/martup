// ==================== ORDER & REFUND EMAIL TEMPLATES ====================
// Professional, mobile-responsive email templates for MartUp notifications.
// Each template returns { subject, html } for use with sendEmail().

// HTML-escape helper to prevent XSS in email clients
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const BASE_URL = process.env.NEXTAUTH_URL || 'https://martup-seven.vercel.app'
const STORE_NAME = 'MartUp'
const YEAR = new Date().getFullYear()

// Shared CSS styles for consistent branding
const BASE_STYLES = `
  margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif
`
const CARD_STYLE = `
  max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)
`
const HEADER_BG = `background:linear-gradient(135deg,#10b981,#14b8a6);padding:32px;text-align:center`
const FOOTER_STYLE = `padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb`

// ─── Order Data Types ───

export interface OrderEmailData {
  orderNumber: string
  userName: string
  userEmail: string
  items: Array<{ productName: string; quantity: number; price: number; image?: string | null }>
  totalAmount: number
  shippingCost?: number
  discountAmount?: number
  sellerName?: string
}

export interface ComplaintEmailData {
  orderNumber: string
  userName: string
  userEmail: string
  type: string // refund, return, complain
  reason: string
  status: string // open, processing, resolved, rejected
  resolution?: string | null
  refundAmount?: number | null
  items?: Array<{ productName: string; quantity: number }>
}

// ─── Helper: Build items summary table ───

function buildItemsSummary(items: OrderEmailData['items']): string {
  if (!items || items.length === 0) return ''

  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px">
        ${escapeHtml(item.productName)}
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px;text-align:center">
        x${item.quantity}
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;text-align:right">
        Rp ${(item.price * item.quantity).toLocaleString('id-ID')}
      </td>
    </tr>
  `).join('')

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;margin:16px 0;overflow:hidden">
      <thead>
        <tr>
          <th style="padding:12px 16px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Produk</th>
          <th style="padding:12px 16px;text-align:center;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Qty</th>
          <th style="padding:12px 16px;text-align:right;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Harga</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

// ─── Helper: Action button ───

function actionButton(url: string, label: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
      <tr>
        <td align="center">
          <a href="${url}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#10b981,#14b8a6);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.3px">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `
}

// ─── Helper: Email wrapper ───

function emailWrapper(headerSubtitle: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="${BASE_STYLES}">
  <table width="100%" cellpadding="0" cellspacing="0" style="${CARD_STYLE}">
    <tr>
      <td style="${HEADER_BG}">
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px">${STORE_NAME}</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px">${headerSubtitle}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px">
        ${bodyContent}
      </td>
    </tr>
    <tr>
      <td style="${FOOTER_STYLE}">
        <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.5">
          Pesan ini dikirim secara otomatis oleh ${STORE_NAME}. Jika Anda tidak mengenali aktivitas ini, silakan hubungi customer service kami.
        </p>
        <p style="margin:12px 0 0;color:#d1d5db;font-size:11px;text-align:center">
          &copy; ${YEAR} ${STORE_NAME}. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ═══════════════════════════════════════════════════════════════════
// 1. ORDER CONFIRMED — "Pesanan Anda Dikonfirmasi"
// ═══════════════════════════════════════════════════════════════════

export function orderConfirmedTemplate(order: OrderEmailData): { subject: string; html: string } {
  const subject = `Pesanan Dikonfirmasi — #${order.orderNumber}`
  const orderDetailUrl = `${BASE_URL}/orders`

  const body = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;font-weight:700">Halo ${escapeHtml(order.userName)}! ✅</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6">
      Pembayaran Anda telah dikonfirmasi dan pesanan sedang disiapkan oleh penjual.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border-radius:12px;padding:16px;margin:0 0 8px">
      <tr>
        <td style="padding:12px 16px">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Nomor Pesanan</p>
          <p style="margin:4px 0 0;color:#1f2937;font-size:18px;font-weight:700">#${order.orderNumber}</p>
        </td>
        <td style="padding:12px 16px;text-align:right">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Total</p>
          <p style="margin:4px 0 0;color:#10b981;font-size:18px;font-weight:700">Rp ${order.totalAmount.toLocaleString('id-ID')}</p>
        </td>
      </tr>
    </table>
    ${order.sellerName ? `<p style="margin:0 0 4px;color:#6b7280;font-size:14px"><strong>Penjual:</strong> ${escapeHtml(order.sellerName)}</p>` : ''}
    ${buildItemsSummary(order.items)}
    ${actionButton(orderDetailUrl, 'Lihat Detail Pesanan')}
  `

  return { subject, html: emailWrapper('Pesanan Dikonfirmasi', body) }
}

// ═══════════════════════════════════════════════════════════════════
// 2. ORDER SHIPPED — "Pesanan Anda Dikirim"
// ═══════════════════════════════════════════════════════════════════

export function orderShippedTemplate(order: OrderEmailData, trackingNumber?: string): { subject: string; html: string } {
  const subject = `Pesanan Dikirim — #${order.orderNumber}`
  const orderDetailUrl = `${BASE_URL}/orders`

  const trackingBlock = trackingNumber ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:12px;padding:16px;margin:16px 0">
      <tr>
        <td style="padding:12px 16px;text-align:center">
          <p style="margin:0;color:#6b7280;font-size:13px">Nomor Resi</p>
          <p style="margin:4px 0 0;color:#1d4ed8;font-size:20px;font-weight:700;letter-spacing:1px">${trackingNumber}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;text-align:center">
      Gunakan nomor resi untuk melacak paket Anda
    </p>
  ` : ''

  const body = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;font-weight:700">Halo ${escapeHtml(order.userName)}! 📦</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6">
      Pesanan Anda telah dikirim dan sedang dalam perjalanan.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;padding:16px;margin:0 0 8px">
      <tr>
        <td style="padding:12px 16px">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Nomor Pesanan</p>
          <p style="margin:4px 0 0;color:#1f2937;font-size:16px;font-weight:700">#${order.orderNumber}</p>
        </td>
        <td style="padding:12px 16px;text-align:right">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Status</p>
          <p style="margin:4px 0 0;color:#f59e0b;font-size:16px;font-weight:700">Dikirim 🚚</p>
        </td>
      </tr>
    </table>
    ${trackingBlock}
    ${buildItemsSummary(order.items)}
    ${actionButton(orderDetailUrl, 'Lacak Pesanan')}
  `

  return { subject, html: emailWrapper('Pesanan Dikirim', body) }
}

// ═══════════════════════════════════════════════════════════════════
// 3. ORDER DELIVERED — "Pesanan Diterima"
// ═══════════════════════════════════════════════════════════════════

export function orderDeliveredTemplate(order: OrderEmailData): { subject: string; html: string } {
  const subject = `Pesanan Diterima — #${order.orderNumber}`
  const orderDetailUrl = `${BASE_URL}/orders`

  const body = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;font-weight:700">Halo ${escapeHtml(order.userName)}! 🎉</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6">
      Pesanan Anda telah berhasil diterima. Dana penjual telah dicairkan. Terima kasih telah berbelanja di MartUp!
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border-radius:12px;padding:16px;margin:0 0 8px">
      <tr>
        <td style="padding:12px 16px">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Nomor Pesanan</p>
          <p style="margin:4px 0 0;color:#1f2937;font-size:16px;font-weight:700">#${order.orderNumber}</p>
        </td>
        <td style="padding:12px 16px;text-align:right">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Status</p>
          <p style="margin:4px 0 0;color:#10b981;font-size:16px;font-weight:700">Selesai ✅</p>
        </td>
      </tr>
    </table>
    ${buildItemsSummary(order.items)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:14px;line-height:1.6">
      Jangan lupa untuk memberikan review pada produk yang Anda beli! Review Anda membantu pembeli lain membuat keputusan yang lebih baik.
    </p>
    ${actionButton(orderDetailUrl, 'Beri Review')}
  `

  return { subject, html: emailWrapper('Pesanan Diterima', body) }
}

// ═══════════════════════════════════════════════════════════════════
// 4. ORDER CANCELLED — "Pesanan Dibatalkan"
// ═══════════════════════════════════════════════════════════════════

export function orderCancelledTemplate(order: OrderEmailData, reason?: string): { subject: string; html: string } {
  const subject = `Pesanan Dibatalkan — #${order.orderNumber}`
  const orderDetailUrl = `${BASE_URL}/orders`

  const reasonBlock = reason ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:12px;padding:16px;margin:16px 0">
      <tr>
        <td style="padding:12px 16px">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Alasan Pembatalan</p>
          <p style="margin:4px 0 0;color:#ef4444;font-size:14px;line-height:1.5">${escapeHtml(reason)}</p>
        </td>
      </tr>
    </table>
  ` : ''

  const refundNote = `
    <p style="margin:16px 0 0;color:#6b7280;font-size:14px;line-height:1.6">
      💰 Jika pembayaran sudah dilakukan, dana akan dikembalikan ke saldo MartUp Anda dalam 1x24 jam.
    </p>
  `

  const body = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;font-weight:700">Halo ${escapeHtml(order.userName)}!</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6">
      Pesanan Anda telah dibatalkan.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:12px;padding:16px;margin:0 0 8px">
      <tr>
        <td style="padding:12px 16px">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Nomor Pesanan</p>
          <p style="margin:4px 0 0;color:#1f2937;font-size:16px;font-weight:700">#${order.orderNumber}</p>
        </td>
        <td style="padding:12px 16px;text-align:right">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Status</p>
          <p style="margin:4px 0 0;color:#ef4444;font-size:16px;font-weight:700">Dibatalkan ✕</p>
        </td>
      </tr>
    </table>
    ${reasonBlock}
    ${buildItemsSummary(order.items)}
    ${refundNote}
    ${actionButton(orderDetailUrl, 'Lihat Detail Pesanan')}
  `

  return { subject, html: emailWrapper('Pesanan Dibatalkan', body) }
}

// ═══════════════════════════════════════════════════════════════════
// 5. REFUND STATUS — "Status Pengembalian Diperbarui"
// ═══════════════════════════════════════════════════════════════════

const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  refund: 'Pengembalian Dana',
  return: 'Pengembalian Barang',
  complain: 'Keluhan',
}

const COMPLAINT_STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  open: { label: 'Dibuka', color: '#f59e0b', emoji: '🟡' },
  processing: { label: 'Diproses', color: '#3b82f6', emoji: '🔵' },
  resolved: { label: 'Diselesaikan', color: '#10b981', emoji: '🟢' },
  rejected: { label: 'Ditolak', color: '#ef4444', emoji: '🔴' },
}

export function refundStatusTemplate(complaint: ComplaintEmailData): { subject: string; html: string } {
  const typeLabel = COMPLAINT_TYPE_LABELS[complaint.type] || complaint.type
  const statusConfig = COMPLAINT_STATUS_CONFIG[complaint.status] || { label: complaint.status, color: '#6b7280', emoji: '⚪' }
  const subject = `${typeLabel} ${statusConfig.label} — #${complaint.orderNumber}`
  const orderDetailUrl = `${BASE_URL}/orders`

  const resolutionBlock = complaint.resolution ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:12px;padding:16px;margin:16px 0">
      <tr>
        <td style="padding:12px 16px">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Resolusi</p>
          <p style="margin:4px 0 0;color:#374151;font-size:14px;line-height:1.6">${escapeHtml(complaint.resolution)}</p>
        </td>
      </tr>
    </table>
  ` : ''

  const refundBlock = complaint.refundAmount ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border-radius:12px;padding:16px;margin:16px 0">
      <tr>
        <td style="padding:12px 16px;text-align:center">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Jumlah Pengembalian</p>
          <p style="margin:4px 0 0;color:#10b981;font-size:22px;font-weight:700">Rp ${complaint.refundAmount.toLocaleString('id-ID')}</p>
        </td>
      </tr>
    </table>
  ` : ''

  const itemsBlock = complaint.items && complaint.items.length > 0 ? `
    <p style="margin:16px 0 8px;color:#6b7280;font-size:14px"><strong>Produk:</strong></p>
    <ul style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.8">
      ${complaint.items.map(i => `<li>${escapeHtml(i.productName)} (x${i.quantity})</li>`).join('')}
    </ul>
  ` : ''

  const body = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;font-weight:700">Halo ${escapeHtml(complaint.userName)}! ${statusConfig.emoji}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6">
      Status ${typeLabel.toLowerCase()} Anda untuk pesanan <strong>#${complaint.orderNumber}</strong> telah diperbarui.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;padding:16px;margin:0 0 8px">
      <tr>
        <td style="padding:12px 16px">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Jenis</p>
          <p style="margin:4px 0 0;color:#374151;font-size:14px;font-weight:600">${typeLabel}</p>
        </td>
        <td style="padding:12px 16px;text-align:right">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Status</p>
          <p style="margin:4px 0 0;color:${statusConfig.color};font-size:16px;font-weight:700">${statusConfig.label} ${statusConfig.emoji}</p>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 4px;color:#6b7280;font-size:14px"><strong>Alasan:</strong> ${escapeHtml(complaint.reason)}</p>
    ${itemsBlock}
    ${resolutionBlock}
    ${refundBlock}
    ${complaint.status === 'resolved' ? `
      <p style="margin:16px 0 0;color:#6b7280;font-size:14px;line-height:1.6">
        💰 Dana pengembalian telah dikreditkan ke saldo MartUp Anda.
      </p>
    ` : ''}
    ${complaint.status === 'processing' ? `
      <p style="margin:16px 0 0;color:#6b7280;font-size:14px;line-height:1.6">
        Tim kami sedang meninjau pengajuan Anda. Kami akan memberikan update secepatnya.
      </p>
    ` : ''}
    ${actionButton(orderDetailUrl, 'Lihat Detail Pesanan')}
  `

  return { subject, html: emailWrapper('Update Pengembalian', body) }
}
