import pino from 'pino'

// ==================== STRUCTURED LOGGING ====================
// Production-grade structured logger using Pino
// Supports: levels, request ID tracking, JSON output, pretty printing in dev

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogContext {
  [key: string]: unknown
}

interface RequestLogContext extends LogContext {
  method?: string
  path?: string
  statusCode?: number
  duration?: number
  userId?: string
  requestId?: string
  ip?: string
  userAgent?: string
}

// Create the base logger
const isDev = process.env.NODE_ENV === 'development'

const logger = pino({
  level: (process.env.LOG_LEVEL || (isDev ? 'debug' : 'info')) as LogLevel,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Production: structured JSON output
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
  // Base fields included in every log
  base: {
    service: 'martup-api',
    env: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
  },
  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'otpCode',
      'token',
      'authorization',
      'cookie',
      '*.password',
      '*.otpCode',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
})

// ==================== CHILD LOGGERS ====================

/** API route logger with request context */
export function createRequestLogger(context: RequestLogContext = {}) {
  return logger.child({
    component: 'api',
    ...context,
  })
}

/** Auth event logger */
export function createAuthLogger(context: LogContext = {}) {
  return logger.child({
    component: 'auth',
    ...context,
  })
}

/** Payment event logger */
export function createPaymentLogger(context: LogContext = {}) {
  return logger.child({
    component: 'payment',
    ...context,
  })
}

/** Database operation logger */
export function createDbLogger(context: LogContext = {}) {
  return logger.child({
    component: 'db',
    ...context,
  })
}

/** WebSocket/chat logger */
export function createChatLogger(context: LogContext = {}) {
  return logger.child({
    component: 'chat',
    ...context,
  })
}

/** General security logger */
export function createSecurityLogger(context: LogContext = {}) {
  return logger.child({
    component: 'security',
    ...context,
  })
}

// ==================== CONVENIENCE EXPORTS ====================

export { logger }
export default logger

// ==================== REQUEST LOGGING HELPER ====================

/**
 * Log an API request with standard fields.
 * Call at the end of route handlers after response is determined.
 */
export function logApiRequest(params: {
  method: string
  path: string
  statusCode: number
  duration: number
  userId?: string
  requestId?: string
  ip?: string
  userAgent?: string
  error?: Error | unknown
}) {
  const { error, ...rest } = params
  const level: LogLevel = params.statusCode >= 500 ? 'error' : params.statusCode >= 400 ? 'warn' : 'info'

  logger[level](
    {
      ...rest,
      component: 'api',
      ...(error instanceof Error
        ? { errorMessage: error.message, errorStack: error.stack }
        : error
          ? { error: String(error) }
          : {}),
    },
    `${params.method} ${params.path} ${params.statusCode} - ${params.duration}ms`
  )
}

/**
 * Log a security event (auth failure, rate limit hit, CSRF violation, etc.)
 */
export function logSecurityEvent(params: {
  event: string
  userId?: string
  ip?: string
  path?: string
  details?: Record<string, unknown>
}) {
  logger.warn(
    {
      component: 'security',
      ...params,
    },
    `SECURITY: ${params.event}`
  )
}

/**
 * Log a business event (order placed, withdrawal requested, etc.)
 */
export function logBusinessEvent(params: {
  event: string
  userId?: string
  details?: Record<string, unknown>
}) {
  logger.info(
    {
      component: 'business',
      ...params,
    },
    `BUSINESS: ${params.event}`
  )
}
