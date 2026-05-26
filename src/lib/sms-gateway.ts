// ==================== SMS GATEWAY ABSTRACTION ====================
// Unified SMS/WhatsApp gateway supporting multiple providers:
// - mock: Development only, logs OTP (default)
// - twilio: SMS via Twilio REST API
// - fonnte: WhatsApp via Fonnte API (popular in Indonesia)
//
// Provider is configured via SMS_PROVIDER env var (default: mock)
// Each provider has its own set of environment variables.

import { logger } from '@/lib/logger'

// ==================== TYPES ====================

export interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
  provider: string
}

type SMSProvider = 'mock' | 'twilio' | 'fonnte'

// ==================== PHONE NORMALIZATION ====================

/**
 * Normalize Indonesian phone numbers to international format for Twilio.
 * - 081234567890  → +6281234567890
 * - 6281234567890 → +6281234567890
 * - +6281234567890 → +6281234567890 (keep as is)
 *
 * For Fonnte (WhatsApp), the format without '+' is preferred:
 * - Returns the digits without '+' prefix
 */
export function normalizePhoneInternational(phone: string): string {
  // Strip whitespace and dashes
  let cleaned = phone.replace(/[\s\-()]/g, '')

  // Already in international format
  if (cleaned.startsWith('+62')) {
    return cleaned
  }

  // Starts with 62 without plus
  if (cleaned.startsWith('62')) {
    return `+${cleaned}`
  }

  // Starts with 0 (local Indonesian format)
  if (cleaned.startsWith('0')) {
    return `+62${cleaned.slice(1)}`
  }

  // Fallback: assume it's a valid number, prepend +
  return `+${cleaned}`
}

/**
 * Normalize phone for Fonnte (WhatsApp): digits only, starts with 62, no +
 * - 081234567890  → 6281234567890
 * - +6281234567890 → 6281234567890
 * - 6281234567890 → 6281234567890
 */
function normalizePhoneFonnte(phone: string): string {
  // Strip everything non-digit
  const digits = phone.replace(/\D/g, '')

  // Already starts with 62
  if (digits.startsWith('62')) {
    return digits
  }

  // Starts with 0
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`
  }

  return digits
}

// ==================== PROVIDER: MOCK ====================

async function sendMock(phone: string, message: string): Promise<SMSResult> {
  logger.info(
    { component: 'sms-gateway', provider: 'mock', phone },
    `[SMS/Mock] Message to ${phone}: ${message}`
  )
  return {
    success: true,
    messageId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    provider: 'mock',
  }
}

// ==================== PROVIDER: TWILIO ====================

async function sendTwilio(phone: string, message: string): Promise<SMSResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !twilioPhone) {
    logger.error(
      { component: 'sms-gateway', provider: 'twilio' },
      '[SMS/Twilio] Missing required environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)'
    )
    return {
      success: false,
      error: 'Twilio credentials not configured',
      provider: 'twilio',
    }
  }

  const normalizedPhone = normalizePhoneInternational(phone)

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const body = new URLSearchParams({
      To: normalizedPhone,
      From: twilioPhone,
      Body: message,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    const data = await response.json()

    if (!response.ok) {
      const errorMsg = data.message || data.error_message || `HTTP ${response.status}`
      logger.error(
        { component: 'sms-gateway', provider: 'twilio', phone: normalizedPhone, status: response.status, error: errorMsg },
        `[SMS/Twilio] Failed to send: ${errorMsg}`
      )
      return {
        success: false,
        error: errorMsg,
        provider: 'twilio',
      }
    }

    logger.info(
      { component: 'sms-gateway', provider: 'twilio', phone: normalizedPhone, messageId: data.sid },
      `[SMS/Twilio] Message sent successfully to ${normalizedPhone}`
    )

    return {
      success: true,
      messageId: data.sid,
      provider: 'twilio',
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error(
      { err: error, component: 'sms-gateway', provider: 'twilio', phone: normalizedPhone },
      `[SMS/Twilio] Exception: ${errorMsg}`
    )
    return {
      success: false,
      error: errorMsg,
      provider: 'twilio',
    }
  }
}

// ==================== PROVIDER: FONNTE (WhatsApp) ====================

async function sendFonnte(phone: string, message: string): Promise<SMSResult> {
  const apiKey = process.env.FONNTE_API_KEY
  const deviceId = process.env.FONNTE_DEVICE_ID

  if (!apiKey) {
    logger.error(
      { component: 'sms-gateway', provider: 'fonnte' },
      '[SMS/Fonnte] Missing required environment variable (FONNTE_API_KEY)'
    )
    return {
      success: false,
      error: 'Fonnte API key not configured',
      provider: 'fonnte',
    }
  }

  const normalizedPhone = normalizePhoneFonnte(phone)

  try {
    const body: Record<string, string> = {
      target: normalizedPhone,
      message: message,
    }

    if (deviceId) {
      body.deviceId = deviceId
    }

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    // Fonnte returns { status: true, ... } on success
    if (!data.status && !response.ok) {
      const errorMsg = data.reason || data.message || `HTTP ${response.status}`
      logger.error(
        { component: 'sms-gateway', provider: 'fonnte', phone: normalizedPhone, status: response.status, error: errorMsg },
        `[SMS/Fonnte] Failed to send: ${errorMsg}`
      )
      return {
        success: false,
        error: errorMsg,
        provider: 'fonnte',
      }
    }

    // Some Fonnte responses have status: false with a reason
    if (data.status === false) {
      const errorMsg = data.reason || data.message || 'Unknown Fonnte error'
      logger.error(
        { component: 'sms-gateway', provider: 'fonnte', phone: normalizedPhone, error: errorMsg },
        `[SMS/Fonnte] API returned error: ${errorMsg}`
      )
      return {
        success: false,
        error: errorMsg,
        provider: 'fonnte',
      }
    }

    const messageId = data.id || data.messageId || `fonnte_${Date.now()}`

    logger.info(
      { component: 'sms-gateway', provider: 'fonnte', phone: normalizedPhone, messageId },
      `[SMS/Fonnte] WhatsApp message sent successfully to ${normalizedPhone}`
    )

    return {
      success: true,
      messageId: String(messageId),
      provider: 'fonnte',
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error(
      { err: error, component: 'sms-gateway', provider: 'fonnte', phone: normalizedPhone },
      `[SMS/Fonnte] Exception: ${errorMsg}`
    )
    return {
      success: false,
      error: errorMsg,
      provider: 'fonnte',
    }
  }
}

// ==================== PUBLIC API ====================

/**
 * Get the current SMS provider from environment.
 * Defaults to 'mock' for safe development.
 */
function getProvider(): SMSProvider {
  const provider = process.env.SMS_PROVIDER as SMSProvider
  const validProviders: SMSProvider[] = ['mock', 'twilio', 'fonnte']

  if (provider && validProviders.includes(provider)) {
    return provider
  }

  if (provider && !validProviders.includes(provider)) {
    logger.warn(
      { component: 'sms-gateway', configuredProvider: provider },
      `[SMS] Unknown provider "${provider}", falling back to "mock"`
    )
  }

  return 'mock'
}

/**
 * Send an arbitrary SMS/WhatsApp message to a phone number.
 * Uses the configured provider (SMS_PROVIDER env var).
 * Never throws — returns SMSResult with error details on failure.
 */
export async function sendSMS(phone: string, message: string): Promise<SMSResult> {
  const provider = getProvider()

  logger.info(
    { component: 'sms-gateway', provider, phone },
    `[SMS] Sending message via ${provider} to ${phone}`
  )

  try {
    switch (provider) {
      case 'twilio':
        return await sendTwilio(phone, message)
      case 'fonnte':
        return await sendFonnte(phone, message)
      case 'mock':
      default:
        return await sendMock(phone, message)
    }
  } catch (error) {
    // Extra safety net — should never reach here since providers catch internally
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error(
      { err: error, component: 'sms-gateway', provider, phone },
      `[SMS] Unexpected error in sendSMS: ${errorMsg}`
    )
    return {
      success: false,
      error: errorMsg,
      provider,
    }
  }
}

/**
 * Send an OTP code to a phone number with a formatted Indonesian message.
 * Message format:
 *   "Kode OTP MartUp Anda: {code}. Berlaku {expiry} menit. Jangan bagikan kode ini."
 *
 * Never throws — returns SMSResult with error details on failure.
 * The OTP is already stored in the database; SMS delivery failure is logged
 * but does not block the OTP flow (user can request retry).
 */
export async function sendOTP(
  phone: string,
  otpCode: string,
  expiryMinutes: number
): Promise<SMSResult> {
  const message = `Kode OTP MartUp Anda: ${otpCode}. Berlaku ${expiryMinutes} menit. Jangan bagikan kode ini.`

  logger.info(
    { component: 'sms-gateway', phone, expiryMinutes },
    `[SMS/OTP] Sending OTP to ${phone} (expires in ${expiryMinutes} min)`
  )

  const result = await sendSMS(phone, message)

  if (result.success) {
    logger.info(
      { component: 'sms-gateway', provider: result.provider, phone, messageId: result.messageId },
      `[SMS/OTP] OTP delivered successfully to ${phone} via ${result.provider}`
    )
  } else {
    // Log the error but don't throw — OTP is already stored in DB and can be retried
    logger.warn(
      { component: 'sms-gateway', provider: result.provider, phone, error: result.error },
      `[SMS/OTP] Failed to deliver OTP to ${phone} via ${result.provider}: ${result.error}. OTP is stored in DB and can be retried.`
    )
  }

  return result
}
