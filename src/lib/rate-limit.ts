// ==================== DISTRIBUTED RATE LIMITING ====================
// Abstraction layer that supports both in-memory (dev/single-instance)
// and Redis/Vercel KV (production/distributed) backends.
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
    return { count, ttl: Math.max(ttl, 0) }
  }

  async reset(key: string): Promise<void> {
    await this.client.del(key)
  }
}

// ==================== RATE LIMITER FACTORY ====================

let defaultBackend: RateLimiterBackend | null = null

/**
 * Initialize the rate limiter backend.
 * - Without arguments: uses in-memory backend (for dev / single-instance)
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
    const inMemory = new InMemoryBackend()
    inMemory.startCleanup()
    defaultBackend = inMemory
  }
}

function getBackend(): RateLimiterBackend {
  if (!defaultBackend) {
    initRateLimiterBackend() // Auto-init in-memory
  }
  return defaultBackend!
}

/**
 * Create a rate limiter with the given config.
 * Uses the global backend (in-memory or Redis).
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
      const { count, ttl } = await backend.increment(key, windowMs)
      const resetAt = Date.now() + ttl

      return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
        resetAt,
        total: maxRequests,
      }
    },

    async reset(identifier: string): Promise<void> {
      const key = `${keyPrefix}${identifier}`
      await backend.reset(key)
    },
  }
}

// ==================== PRE-CONFIGURED LIMITERS ====================

/** General API rate limiter: 60 req/min */
export const apiLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60, keyPrefix: 'rl:api:' })

/** Auth rate limiter: 10 req/min */
export const authLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:auth:' })

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
