// ==================== DISTRIBUTED RATE LIMITING ====================
// Abstraction layer that supports both in-memory (dev/single-instance)
// and Redis/Vercel KV (production/distributed) backends.
//
// AUTO-DETECTION: If KV_REST_API_URL and KV_REST_API_TOKEN are set
// (Vercel KV), the Vercel KV backend is automatically used in production.
// Otherwise, falls back to in-memory (works for dev, resets on serverless cold starts).
//
// Usage:
//   const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 10 })
//   const result = await limiter.check('user:123')
//   if (!result.allowed) return 429 response

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // Unix timestamp in ms when the window resets
  total: number
}

export interface RateLimiterConfig {
  /** Time window in milliseconds */
  windowMs: number
  /** Max requests allowed within the window */
  maxRequests: number
  /** Key prefix for storage (default: 'rl:') */
  keyPrefix?: string
}

export interface RateLimiterBackend {
  increment(key: string, windowMs: number): Promise<{ count: number; ttl: number }>
  reset(key: string): Promise<void>
}

// ==================== IN-MEMORY BACKEND ====================

class InMemoryBackend implements RateLimiterBackend {
  private store = new Map<string, { count: number; expiresAt: number }>()

  async increment(key: string, windowMs: number): Promise<{ count: number; ttl: number }> {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now > entry.expiresAt) {
      const expiresAt = now + windowMs
      this.store.set(key, { count: 1, expiresAt })
      return { count: 1, ttl: windowMs }
    }

    entry.count++
    return { count: entry.count, ttl: entry.expiresAt - now }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key)
  }

  // Cleanup expired entries periodically
  startCleanup(intervalMs: number = 5 * 60 * 1000) {
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.store.entries()) {
        if (now > entry.expiresAt) {
          this.store.delete(key)
        }
      }
    }, intervalMs)
  }
}

// ==================== REDIS / VERCEL KV BACKEND ====================

class RedisBackend implements RateLimiterBackend {
  private client: {
    incr: (key: string) => Promise<number>
    pexpire: (key: string, ms: number) => Promise<number>
    pttl: (key: string) => Promise<number>
    del: (key: string) => Promise<number>
    eval: (script: string, keys: string[], args: (string | number)[]) => Promise<number>
  }

  constructor(client: RedisBackend['client']) {
    this.client = client
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; ttl: number }> {
    // Use atomic INCR + EXPIRE for distributed safety
    const count = await this.client.incr(key)
    if (count === 1) {
      // First request in window — set expiry
      await this.client.pexpire(key, windowMs)
      return { count: 1, ttl: windowMs }
    }
    const ttl = await this.client.pttl(key)
    // SAFETY: If the key has no TTL (ttl = -1) or TTL is way too long, reset it.
    // This prevents stale keys from persisting indefinitely and locking users out.
    if (ttl === -1 || ttl > windowMs * 2) {
      await this.client.pexpire(key, windowMs)
      return { count, ttl: windowMs }
    }
    return { count, ttl: Math.max(ttl, 0) }
  }

  async reset(key: string): Promise<void> {
    await this.client.del(key)
  }
}

// ==================== VERCEL KV REST API BACKEND ====================
// Uses the Vercel KV REST API directly — no @vercel/kv package needed.
// Auto-detected from KV_REST_API_URL and KV_REST_API_TOKEN env vars.

class VercelKVBackend implements RateLimiterBackend {
  private url: string
  private token: string

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, '') // Remove trailing slash
    this.token = token
  }

  /**
   * Execute a Vercel KV REST API command and extract the `result` field.
   * The Vercel KV (Upstash) REST API returns: {"result": <value>}
   * We must extract `.result` to get the actual value, not the wrapper object.
   */
  private async fetch<T>(command: string, args: (string | number)[]): Promise<T> {
    const response = await fetch(`${this.url}/${command}/${args.map(encodeURIComponent).join('/')}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    })
    if (!response.ok) {
      throw new Error(`Vercel KV error: ${response.status} ${response.statusText}`)
    }
    const json = await response.json() as { result: T }
    return json.result
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; ttl: number }> {
    // INCR returns the new value
    const count = await this.fetch<number>('incr', [key])
    if (count === 1) {
      // First request — set expiry
      await this.fetch<number>('pexpire', [key, windowMs])
      return { count: 1, ttl: windowMs }
    }
    const ttl = await this.fetch<number>('pttl', [key])
    // SAFETY: If the key has no TTL (ttl = -1) or TTL is way too long, reset it.
    // This prevents stale keys from persisting indefinitely and locking users out.
    if (ttl === -1 || ttl > windowMs * 2) {
      await this.fetch<number>('pexpire', [key, windowMs])
      return { count, ttl: windowMs }
    }
    return { count, ttl: Math.max(ttl, 0) }
  }

  async reset(key: string): Promise<void> {
    await this.fetch<number>('del', [key])
  }
}

// ==================== RATE LIMITER FACTORY ====================

let defaultBackend: RateLimiterBackend | null = null
let backendInitialized = false

/**
 * Initialize the rate limiter backend.
 * - Without arguments: auto-detects Vercel KV (if env vars set) or falls back to in-memory
 * - With a Redis/KV client: uses distributed backend (for production)
 */
export function initRateLimiterBackend(
  redisClient?: {
    incr: (key: string) => Promise<number>
    pexpire: (key: string, ms: number) => Promise<number>
    pttl: (key: string) => Promise<number>
    del: (key: string) => Promise<number>
    eval: (script: string, keys: string[], args: (string | number)[]) => Promise<number>
  }
): void {
  if (redisClient) {
    defaultBackend = new RedisBackend(redisClient)
  } else {
    // AUTO-DETECT: Use Vercel KV REST API if env vars are available
    const kvUrl = process.env.KV_REST_API_URL
    const kvToken = process.env.KV_REST_API_TOKEN
    if (kvUrl && kvToken) {
      defaultBackend = new VercelKVBackend(kvUrl, kvToken)
      console.log('[rate-limit] Using Vercel KV backend (distributed)')
    } else {
      const inMemory = new InMemoryBackend()
      inMemory.startCleanup()
      defaultBackend = inMemory
      if (process.env.NODE_ENV === 'production') {
        console.warn('[rate-limit] WARNING: Using in-memory backend in production. Rate limits will NOT persist across serverless cold starts. Set up Vercel KV (KV_REST_API_URL + KV_REST_API_TOKEN) for distributed rate limiting.')
      }
    }
  }
  backendInitialized = true
}

function getBackend(): RateLimiterBackend {
  if (!defaultBackend || !backendInitialized) {
    initRateLimiterBackend() // Auto-init with detection
  }
  return defaultBackend!
}

/**
 * Check if the rate limiter is using a distributed (persistent) backend.
 * Returns true if Vercel KV or Redis is configured.
 */
export function isDistributedBackend(): boolean {
  const backend = getBackend()
  return backend instanceof VercelKVBackend || backend instanceof RedisBackend
}

/**
 * Create a rate limiter with the given config.
 * Uses the global backend (in-memory, Vercel KV, or Redis).
 */
export function createRateLimiter(config: RateLimiterConfig): {
  check: (identifier: string) => Promise<RateLimitResult>
  reset: (identifier: string) => Promise<void>
} {
  const { windowMs, maxRequests, keyPrefix = 'rl:' } = config
  const backend = getBackend()

  return {
    async check(identifier: string): Promise<RateLimitResult> {
      const key = `${keyPrefix}${identifier}`
      try {
        const { count, ttl } = await backend.increment(key, windowMs)
        const resetAt = Date.now() + ttl

        return {
          allowed: count <= maxRequests,
          remaining: Math.max(0, maxRequests - count),
          resetAt,
          total: maxRequests,
        }
      } catch (error) {
        // If distributed backend fails (KV down, network error), allow the request
        // rather than blocking all users. Log the error for monitoring.
        console.error('[rate-limit] Backend error, allowing request:', error)
        return {
          allowed: true,
          remaining: maxRequests,
          resetAt: Date.now() + windowMs,
          total: maxRequests,
        }
      }
    },

    async reset(identifier: string): Promise<void> {
      const key = `${keyPrefix}${identifier}`
      try {
        await backend.reset(key)
      } catch (error) {
        console.error('[rate-limit] Backend reset error:', error)
      }
    },
  }
}

// ==================== PRE-CONFIGURED LIMITERS ====================

/** General API rate limiter: 60 req/min */
export const apiLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60, keyPrefix: 'rl:api:' })

/** Auth rate limiter: 20 req/min — generous enough for legitimate users who typo passwords,
 *  while still blocking brute-force attacks (at 20 req/min, a 6-digit OTP has ~0.02% chance per minute) */
export const authLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20, keyPrefix: 'rl:auth:' })

/** Payment rate limiter: 5 req/min */
export const paymentLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5, keyPrefix: 'rl:pay:' })

/** Upload rate limiter: 10 req/min */
export const uploadLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:upload:' })

/** Chat message rate limiter: 30 req/min */
export const chatLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:chat:' })

/**
 * Helper: Check rate limit and return appropriate headers for the response.
 * Returns null if allowed, or a Response-like object if rate limited.
 */
export async function checkRateLimitAdvanced(
  identifier: string,
  limiter: ReturnType<typeof createRateLimiter> = apiLimiter
): Promise<RateLimitResult> {
  return limiter.check(identifier)
}

/**
 * Build rate limit headers to include in API responses.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.total),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  }
}
