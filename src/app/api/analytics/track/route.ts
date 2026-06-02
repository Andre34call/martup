import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, authErrorResponse } from '@/lib/auth-middleware'
import { apiLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// ==================== ANALYTICS TRACKING ENDPOINT ====================
// Receives batched analytics events from the client and logs them.
// In production, this would forward to a real analytics backend
// (Mixpanel, Amplitude, PostHog, etc.) or a data warehouse.

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 30 events per minute per IP (distributed)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitResult = await apiLimiter.check(`analytics:${clientIp}`)
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json()
    const { events } = body as { events: Array<{ name: string; properties?: Record<string, unknown>; userId?: string }> }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: false, error: 'No events provided' }, { status: 400 })
    }

    if (events.length > 50) {
      return NextResponse.json({ success: false, error: 'Too many events in batch (max 50)' }, { status: 400 })
    }

    // Try to identify user (optional — analytics still works for anonymous users)
    let userId: string | undefined
    try {
      const authResult = await verifyAuth(request)
      if (authResult.success) {
        userId = authResult.user.id
      }
    } catch {
      // Not authenticated — that's OK for analytics
    }

    // Process and log events
    for (const event of events) {
      // Validate event name
      if (!event.name || typeof event.name !== 'string' || event.name.length > 100) {
        continue // Skip invalid events
      }

      // Sanitize properties — only allow primitive values
      const sanitizedProps: Record<string, unknown> = {}
      if (event.properties && typeof event.properties === 'object') {
        for (const [key, value] of Object.entries(event.properties)) {
          if (key.length > 50) continue // Skip overly long keys
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
            sanitizedProps[key] = value
          }
        }
      }

      // Log the event (structured for downstream processing)
      logger.info(
        {
          component: 'analytics',
          event: event.name,
          userId: userId || event.userId,
          properties: sanitizedProps,
          ip: clientIp,
          userAgent: request.headers.get('user-agent'),
        },
        `ANALYTICS: ${event.name}`
      )

      // In production, you would forward to:
      // - Mixpanel: mixpanel.track(event.name, { ...sanitizedProps, distinct_id: userId })
      // - Amplitude: amplitude.track({ event_type: event.name, user_id: userId, event_properties: sanitizedProps })
      // - PostHog: posthog.capture({ distinctId: userId, event: event.name, properties: sanitizedProps })
      // - Data warehouse: INSERT INTO analytics_events ...
    }

    return NextResponse.json({ success: true, processed: events.length })
  } catch (error) {
    logger.error({ error }, 'Analytics tracking failed')
    return NextResponse.json({ success: false, error: 'Failed to process events' }, { status: 500 })
  }
}
