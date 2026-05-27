import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// ==================== HEALTH CHECK ENDPOINT ====================
// Provides detailed health status for monitoring and load balancers.
// Includes: database, memory, uptime checks.

export const dynamic = 'force-dynamic'

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string }
    memory: { status: 'ok' | 'warning' | 'critical'; heapUsedMb: number; heapTotalMb: number; rssMb: number }
  }
}

export async function GET() {
  const startTime = Date.now()
  const checks: HealthCheckResult['checks'] = {
    database: { status: 'error' },
    memory: { status: 'ok', heapUsedMb: 0, heapTotalMb: 0, rssMb: 0 },
  }

  // ===== Database Check =====
  try {
    const dbStart = Date.now()
    await db.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - dbStart
    checks.database = { status: 'ok', latencyMs: dbLatency }
  } catch (error) {
    checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error',
    }
    logger.error({ error }, 'Health check: Database connection failed')
  }

  // ===== Memory Check =====
  const memUsage = process.memoryUsage()
  const heapUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024)
  const heapTotalMb = Math.round(memUsage.heapTotal / 1024 / 1024)
  const rssMb = Math.round(memUsage.rss / 1024 / 1024)

  const memoryStatus = heapUsedMb > 500 ? 'critical' : heapUsedMb > 300 ? 'warning' : 'ok'
  checks.memory = { status: memoryStatus, heapUsedMb, heapTotalMb, rssMb }

  // ===== Overall Status =====
  const hasError = checks.database.status === 'error' || checks.memory.status === 'critical'
  const isDegraded = checks.memory.status === 'warning'
  const overallStatus: HealthCheckResult['status'] = hasError ? 'unhealthy' : isDegraded ? 'degraded' : 'healthy'

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.2.0-feature-sync',
    uptime: process.uptime(),
    checks,
  }

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200

  return NextResponse.json(result, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Health-Status': overallStatus,
      'X-Response-Time': `${Date.now() - startTime}ms`,
    },
  })
}
