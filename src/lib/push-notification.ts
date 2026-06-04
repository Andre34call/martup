// ==================== PUSH NOTIFICATION UTILITY (FCM) ====================
// Sends push notifications via Firebase Cloud Messaging.
// Gracefully handles missing firebase-admin dependency or configuration.

import { db } from './db'
import { logger } from './logger'

export interface PushNotificationParams {
  userId: string
  title: string
  body: string
  data?: Record<string, string>
}

interface FcmMessage {
  token: string
  notification: {
    title: string
    body: string
  }
  data?: Record<string, string>
  android?: {
    priority: 'high' | 'normal'
  }
}

interface FcmResponse {
  success: boolean
  error?: string
  invalidToken?: boolean
}

/**
 * Check if Firebase Cloud Messaging is configured.
 * Returns false if required env vars are missing (graceful skip).
 */
function isFcmConfigured(): boolean {
  return !!(process.env.FIREBASE_PROJECT_ID)
}

/**
 * Send a push notification to a user via FCM.
 *
 * Returns true on success, false if:
 * - User has no FCM token (hasn't enabled push notifications)
 * - Firebase is not configured (env vars missing)
 * - firebase-admin package is not installed
 * - Token is invalid (auto-removes from DB)
 */
export async function sendPushNotification(params: PushNotificationParams): Promise<boolean> {
  const { userId, title, body, data } = params

  try {
    // Step 1: Get user's FCM token from database
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    })

    if (!user?.fcmToken) {
      // User hasn't registered for push notifications — skip silently
      logger.debug({ component: 'push-notification', userId }, 'No FCM token for user, skipping push')
      return false
    }

    // Step 2: Check if Firebase is configured
    if (!isFcmConfigured()) {
      logger.debug({ component: 'push-notification' }, 'Firebase not configured (FIREBASE_PROJECT_ID missing), skipping push notification')
      return false
    }

    // Step 3: Try to send via firebase-admin
    const result = await sendFcmMessage({
      token: user.fcmToken,
      notification: { title, body },
      data,
      android: { priority: 'high' },
    })

    // Step 4: If token is invalid/unregistered, clear it from DB
    if (result.invalidToken) {
      logger.info({ component: 'push-notification', userId }, 'FCM token invalid, clearing from DB')
      await db.user.update({
        where: { id: userId },
        data: { fcmToken: null },
      })
      return false
    }

    if (!result.success) {
      logger.warn({ component: 'push-notification', userId, error: result.error }, 'FCM send failed')
      return false
    }

    return true
  } catch (error) {
    logger.warn({ component: 'push-notification', err: error, userId }, 'Push notification error (non-fatal)')
    return false
  }
}

/**
 * Internal function that attempts to use firebase-admin SDK.
 * Falls back gracefully if the package is not installed.
 */
async function sendFcmMessage(message: FcmMessage): Promise<FcmResponse> {
  try {
    // Dynamic import — will fail if firebase-admin is not installed
    // Using require-style path to prevent Turbopack from bundling/resolving at build time
    let firebaseAdmin: any
    try {
      // @ts-ignore — optional dependency, may not be installed
      firebaseAdmin = await import(/* webpackIgnore: true */ 'firebase-admin')
    } catch {
      logger.debug({ component: 'push-notification' }, 'firebase-admin not installed, skipping push notification')
      return { success: false, error: 'firebase-admin not installed' }
    }

    // Initialize app if not already done
    if (!firebaseAdmin.default.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

      if (!projectId || !clientEmail || !privateKey) {
        return { success: false, error: 'Firebase service account not fully configured' }
      }

      firebaseAdmin.default.initializeApp({
        credential: firebaseAdmin.default.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
    }

    const messaging = firebaseAdmin.default.messaging()
    await messaging.send({
      token: message.token,
      notification: message.notification,
      data: message.data,
      android: message.android,
    })

    return { success: true }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }

    // Token is no longer valid — tell caller to remove it
    if (
      err.code === 'messaging/invalid-registration-token' ||
      err.code === 'messaging/registration-token-not-registered' ||
      err.message?.includes('NotRegistered') ||
      err.message?.includes('InvalidRegistration')
    ) {
      return { success: false, invalidToken: true, error: err.message }
    }

    // firebase-admin package not found
    if (err.message?.includes("Cannot find module") || err.message?.includes("Module not found")) {
      logger.debug({ component: 'push-notification' }, 'firebase-admin not installed, skipping push notification')
      return { success: false, error: 'firebase-admin not installed' }
    }

    return { success: false, error: err.message || 'Unknown FCM error' }
  }
}

/**
 * Send push notification to multiple users (e.g., seller + buyer).
 * Useful for order status updates where both parties should be notified.
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  let successCount = 0
  for (const userId of userIds) {
    const sent = await sendPushNotification({ userId, title, body, data })
    if (sent) successCount++
  }
  return successCount
}
