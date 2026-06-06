import { NextResponse } from 'next/server'
import { getMidtransClientConfig } from '@/lib/midtrans-config'

// GET /api/payment/config — Returns Midtrans client configuration
// This ensures the client Snap.js always uses the same environment as the server,
// preventing "access denied due to unauthorized transaction" errors from sandbox/production mismatch.
// No auth required — this only returns public client key + environment flag.

export async function GET() {
  const config = getMidtransClientConfig()

  if (!config) {
    return NextResponse.json(
      { success: false, error: 'Midtrans not configured' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      clientKey: config.clientKey,
      isProduction: config.isProduction,
      snapJsUrl: config.snapJsUrl,
    },
  })
}
