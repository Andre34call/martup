#!/usr/bin/env node

/**
 * MartUp Load Testing Script
 *
 * Usage:
 *   node scripts/load-test.js [options]
 *
 * Options:
 *   --url=<url>         Base URL (default: http://localhost:3000)
 *   --duration=<sec>    Test duration in seconds (default: 30)
 *   --concurrency=<n>   Concurrent users (default: 10)
 *   --ramp-up=<sec>     Ramp-up time in seconds (default: 5)
 *
 * Examples:
 *   node scripts/load-test.js
 *   node scripts/load-test.js --url=https://martup-seven.vercel.app --concurrency=20 --duration=60
 *
 * No external dependencies required — uses only Node.js built-ins.
 */

const http = require('http')
const https = require('https')

// ==================== CONFIG ====================

const args = process.argv.slice(2)
const BASE_URL = args.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:3000'
const DURATION = parseInt(args.find(a => a.startsWith('--duration='))?.split('=')[1] || '30') * 1000
const CONCURRENCY = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '10')
const RAMP_UP = parseInt(args.find(a => a.startsWith('--ramp-up='))?.split('=')[1] || '5') * 1000

// ==================== RESULTS TRACKING ====================

const results = {
  totalRequests: 0,
  successCount: 0,
  errorCount: 0,
  statusCodes: {},
  responseTimes: [],
  errors: [],
  startTime: Date.now(),
}

function recordResult(statusCode, responseTime, error = null) {
  results.totalRequests++
  results.statusCodes[statusCode] = (results.statusCodes[statusCode] || 0) + 1
  results.responseTimes.push(responseTime)

  if (statusCode >= 200 && statusCode < 400) {
    results.successCount++
  } else {
    results.errorCount++
  }

  if (error) {
    results.errors.push({ error: error.message, time: new Date().toISOString() })
  }
}

// ==================== HTTP REQUEST ====================

function makeRequest(path, method = 'GET') {
  return new Promise((resolve) => {
    const start = Date.now()
    const url = new URL(path, BASE_URL)
    const client = url.protocol === 'https:' ? https : http

    const req = client.request(url, { method }, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        const responseTime = Date.now() - start
        recordResult(res.statusCode, responseTime)
        resolve()
      })
    })

    req.on('error', (error) => {
      const responseTime = Date.now() - start
      recordResult(0, responseTime, error)
      resolve()
    })

    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timeout'))
    })

    req.end()
  })
}

// ==================== TEST SCENARIOS ====================

const scenarios = [
  // Public endpoints (no auth needed)
  { name: 'Homepage', path: '/', weight: 30 },
  { name: 'Products List', path: '/api/products?limit=20', weight: 25 },
  { name: 'Categories', path: '/api/categories', weight: 15 },
  { name: 'Health Check', path: '/api/health', weight: 10 },
  { name: 'Product Search', path: '/api/products?search=sepatu&limit=10', weight: 10 },
  { name: 'Banners', path: '/api/banners', weight: 5 },
  { name: 'Vouchers', path: '/api/vouchers', weight: 5 },
]

// Weighted random scenario selection
const weightedScenarios = []
for (const scenario of scenarios) {
  for (let i = 0; i < scenario.weight; i++) {
    weightedScenarios.push(scenario)
  }
}

function getRandomScenario() {
  return weightedScenarios[Math.floor(Math.random() * weightedScenarios.length)]
}

// ==================== VIRTUAL USER ====================

async function virtualUser(userId) {
  // Wait for ramp-up delay
  const rampDelay = (userId / CONCURRENCY) * RAMP_UP
  await new Promise(resolve => setTimeout(resolve, rampDelay))

  const deadline = results.startTime + DURATION

  while (Date.now() < deadline) {
    const scenario = getRandomScenario()
    try {
      await makeRequest(scenario.path)
    } catch {
      // Error already recorded
    }

    // Random think time between requests (100ms - 2s)
    const thinkTime = 100 + Math.random() * 1900
    await new Promise(resolve => setTimeout(resolve, thinkTime))
  }
}

// ==================== PROGRESS REPORTER ====================

let progressInterval = null

function startProgressReporting() {
  progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - results.startTime) / 1000).toFixed(1)
    const rps = (results.totalRequests / (elapsed || 1)).toFixed(1)
    const avgResponse = results.responseTimes.length > 0
      ? (results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length).toFixed(0)
      : 'N/A'

    process.stdout.write(
      `\r  [${elapsed}s] Requests: ${results.totalRequests} | ` +
      `RPS: ${rps} | Avg: ${avgResponse}ms | ` +
      `Errors: ${results.errorCount}   `
    )
  }, 2000)
}

function stopProgressReporting() {
  if (progressInterval) {
    clearInterval(progressInterval)
    process.stdout.write('\n')
  }
}

// ==================== REPORT ====================

function generateReport() {
  const elapsed = (Date.now() - results.startTime) / 1000
  const rps = (results.totalRequests / elapsed).toFixed(2)

  // Sort response times for percentiles
  const sorted = [...results.responseTimes].sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0
  const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0
  const avg = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0
  const max = sorted[sorted.length - 1] || 0
  const min = sorted[0] || 0

  const errorRate = ((results.errorCount / results.totalRequests) * 100).toFixed(2)

  console.log('\n' + '='.repeat(60))
  console.log('  MARTUP LOAD TEST REPORT')
  console.log('='.repeat(60))
  console.log(`  Target:          ${BASE_URL}`)
  console.log(`  Duration:        ${elapsed.toFixed(1)}s`)
  console.log(`  Concurrency:     ${CONCURRENCY} virtual users`)
  console.log(`  Total Requests:  ${results.totalRequests}`)
  console.log(`  Requests/sec:    ${rps}`)
  console.log('')
  console.log('  Response Times:')
  console.log(`    Min:           ${min}ms`)
  console.log(`    Avg:           ${avg.toFixed(0)}ms`)
  console.log(`    P50:           ${p50}ms`)
  console.log(`    P90:           ${p90}ms`)
  console.log(`    P95:           ${p95}ms`)
  console.log(`    P99:           ${p99}ms`)
  console.log(`    Max:           ${max}ms`)
  console.log('')
  console.log('  Status Codes:')
  for (const [code, count] of Object.entries(results.statusCodes).sort()) {
    const pct = ((count / results.totalRequests) * 100).toFixed(1)
    const label = code === '0' ? 'Connection Error' : `HTTP ${code}`
    console.log(`    ${label}:  ${count} (${pct}%)`)
  }
  console.log('')
  console.log(`  Error Rate:      ${errorRate}%`)
  console.log(`  Success Rate:    ${(100 - parseFloat(errorRate)).toFixed(2)}%`)
  console.log('')

  // Verdict
  const isHealthy = parseFloat(errorRate) < 5 && p95 < 2000
  console.log(`  Verdict:         ${isHealthy ? '✅ HEALTHY' : '⚠️  NEEDS ATTENTION'}`)

  if (results.errors.length > 0) {
    console.log('')
    console.log('  Recent Errors:')
    for (const err of results.errors.slice(-5)) {
      console.log(`    - ${err.error} (${err.time})`)
    }
  }

  console.log('='.repeat(60))

  // Exit code based on health
  process.exit(isHealthy ? 0 : 1)
}

// ==================== MAIN ====================

async function main() {
  console.log('')
  console.log('  🚀 MartUp Load Test')
  console.log(`  Target: ${BASE_URL}`)
  console.log(`  Duration: ${DURATION / 1000}s | Concurrency: ${CONCURRENCY} | Ramp-up: ${RAMP_UP / 1000}s`)
  console.log('')

  // Warm-up request
  console.log('  Warming up...')
  await makeRequest('/api/health')
  console.log('  Warm-up complete. Starting test...\n')

  results.startTime = Date.now()
  startProgressReporting()

  // Launch virtual users
  const users = []
  for (let i = 0; i < CONCURRENCY; i++) {
    users.push(virtualUser(i))
  }

  await Promise.all(users)

  stopProgressReporting()
  generateReport()
}

main().catch((error) => {
  console.error('Load test failed:', error)
  process.exit(1)
})
