// ==================== EMAIL SENDING UTILITY ====================
// Supports multiple providers: mock (dev), resend (production)
// Similar pattern to sms-gateway.ts

import { logger } from './logger'

/**
 * Escape HTML entities in a string to prevent XSS in email templates.
 * User names are directly interpolated into HTML — if a user registers
 * with a name like "<img src=x onerror=alert(1)>", it would inject HTML.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export type EmailProvider = 'mock' | 'resend'

interface EmailMessage {
  to: string
  subject: string
  html: string
  from?: string
}

interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  devUrl?: string // For mock provider - shows what would be sent
  provider?: string // Which provider was actually used
}

function getProvider(): EmailProvider {
  const configured = (process.env.EMAIL_PROVIDER as EmailProvider) || 'mock'
  // If resend is configured but API key is missing, fall back to mock
  if (configured === 'resend' && !process.env.RESEND_API_KEY) {
    logger.warn({ component: 'email' }, 'EMAIL_PROVIDER=resend but RESEND_API_KEY is not set — falling back to mock')
    return 'mock'
  }
  return configured
}

function getFromEmail(): string {
  return process.env.EMAIL_FROM || 'MartUp <onboarding@resend.dev>'
}

// ==================== MOCK PROVIDER (Development) ====================
async function sendMockEmail(message: EmailMessage): Promise<EmailResult> {
  const devToken = Buffer.from(JSON.stringify({
    to: message.to,
    subject: message.subject,
    timestamp: new Date().toISOString(),
  })).toString('base64url')

  logger.info({
    component: 'email',
    provider: 'mock',
    to: message.to,
    subject: message.subject,
  }, 'Mock email sent (would send in production)')

  return {
    success: true,
    messageId: `mock-${Date.now()}`,
    devUrl: `/api/auth/verify-email?token=dev-verify-${devToken}`,
    provider: 'mock',
  }
}

// ==================== RESEND PROVIDER (Production) ====================
async function sendResendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logger.error({ component: 'email' }, 'RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from || getFromEmail(),
        to: message.to,
        subject: message.subject,
        html: message.html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      logger.error({ component: 'email', status: response.status, data }, 'Resend API error')
      return { success: false, error: data.message || 'Failed to send email' }
    }

    logger.info({ component: 'email', provider: 'resend', to: message.to, messageId: data.id }, 'Email sent')

    return {
      success: true,
      messageId: data.id,
      provider: 'resend',
    }
  } catch (error) {
    logger.error({ component: 'email', err: error }, 'Resend send failed')
    return { success: false, error: 'Email service error' }
  }
}

// ==================== MAIN SEND FUNCTION ====================
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = getProvider()

  switch (provider) {
    case 'resend':
      return sendResendEmail(message)
    case 'mock':
    default:
      return sendMockEmail(message)
  }
}

// ==================== EMAIL TEMPLATES ====================
export function emailVerificationTemplate(
  userName: string,
  verificationUrl: string
): { subject: string; html: string } {
  return {
    subject: 'Verifikasi Email MartUp Anda',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#10b981,#14b8a6);padding:32px;text-align:center">
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px">MartUp</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px">Shop Smart, Live Better</p>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding:32px">
        <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;font-weight:700">Halo ${escapeHtml(userName)}! 👋</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
          Terima kasih telah mendaftar di MartUp. Untuk mulai belanja, silakan verifikasi email Anda terlebih dahulu:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <a href="${verificationUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#10b981,#14b8a6);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.3px">
                Verifikasi Email Saya
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;line-height:1.5">
          Jika tombol di atas tidak berfungsi, salin dan tempel link berikut di browser Anda:
        </p>
        <p style="margin:8px 0 0;color:#10b981;font-size:12px;word-break:break-all">
          ${verificationUrl}
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
        <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.5">
          Link verifikasi ini berlaku selama 24 jam. Jika Anda tidak mendaftar di MartUp, abaikan email ini.
        </p>
        <p style="margin:12px 0 0;color:#d1d5db;font-size:11px;text-align:center">
          &copy; ${new Date().getFullYear()} MartUp. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }
}

export function passwordResetTemplate(
  userName: string,
  resetUrl: string
): { subject: string; html: string } {
  return {
    subject: 'Reset Password MartUp Anda',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#10b981,#14b8a6);padding:32px;text-align:center">
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px">MartUp</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px">Shop Smart, Live Better</p>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding:32px">
        <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;font-weight:700">Halo ${escapeHtml(userName)}! 🔐</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
          Kami menerima permintaan untuk mereset password akun MartUp Anda. Klik tombol di bawah untuk membuat password baru:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <a href="${resetUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#10b981,#14b8a6);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.3px">
                Reset Password Saya
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;line-height:1.5">
          Jika tombol di atas tidak berfungsi, salin dan tempel link berikut di browser Anda:
        </p>
        <p style="margin:8px 0 0;color:#10b981;font-size:12px;word-break:break-all">
          ${resetUrl}
        </p>
        <p style="margin:24px 0 0;color:#ef4444;font-size:13px;line-height:1.5">
          ⚠️ Link ini hanya berlaku selama 1 jam. Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan diubah.
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
        <p style="margin:0;color:#d1d5db;font-size:11px;text-align:center">
          &copy; ${new Date().getFullYear()} MartUp. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }
}

export function accountLockedTemplate(
  userName: string,
  lockDurationMinutes: number
): { subject: string; html: string } {
  return {
    subject: 'Keamanan Akun - Akun Anda Sementara Dikunci',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#ef4444,#f97316);padding:32px;text-align:center">
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px">MartUp</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px">Peringatan Keamanan</p>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding:32px">
        <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;font-weight:700">Halo ${escapeHtml(userName)} ⚠️</h2>
        <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6">
          Akun MartUp Anda telah <strong style="color:#ef4444">sementara dikunci</strong> karena terlalu banyak percobaan login yang gagal.
        </p>
        <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6">
          Akun Anda akan dikunci selama <strong>${lockDurationMinutes} menit</strong>. Setelah itu, Anda bisa mencoba login kembali.
        </p>
        <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6">
          Jika Anda tidak melakukan percobaan login ini, seseorang mungkin mencoba mengakses akun Anda. Kami sarankan untuk:
        </p>
        <ul style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.8;padding-left:20px">
          <li>Mengubah password Anda setelah akun terbuka</li>
          <li>Mengaktifkan verifikasi 2 langkah (2FA)</li>
          <li>Tidak menggunakan password yang sama di platform lain</li>
        </ul>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <a href="${process.env.NEXTAUTH_URL || 'https://martup-seven.vercel.app'}/#reset-password" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#f97316);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.3px">
                Reset Password Saya
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
        <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.5">
          Jika ini bukan Anda, segera ubah password dan hubungi support kami.
        </p>
        <p style="margin:12px 0 0;color:#d1d5db;font-size:11px;text-align:center">
          &copy; ${new Date().getFullYear()} MartUp. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }
}

export function emailVerifiedTemplate(userName: string): { subject: string; html: string } {
  return {
    subject: 'Email Terverifikasi - Selamat Datang di MartUp!',
    html: `
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
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800">MartUp</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">🎉</div>
        <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;font-weight:700">Email Terverifikasi!</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">
          Halo ${escapeHtml(userName)}, email Anda telah berhasil diverifikasi. Sekarang Anda bisa login dan mulai belanja di MartUp!
        </p>
        <a href="${process.env.NEXTAUTH_URL || 'https://martup-seven.vercel.app'}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#10b981,#14b8a6);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:700">
          Mulai Belanja
        </a>
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
</html>`,
  }
}
