import { NextRequest, NextResponse } from 'next/server'
import { getBaseUrl } from '@/lib/duitku'

import { logger } from '@/lib/logger'

// ==================== GET /api/payment/return ====================
// Duitku RETURN URL — the user's browser is redirected here from the Duitku
// payment page after completing (or cancelling) the payment.
// Docs: https://docs.duitku.com/pop/id/ → Redirect
//
// Query params sent by Duitku: merchantOrderId, reference, resultCode
//   resultCode: 00 = Success, 01 = Process (unpaid), 02 = Canceled/Failed
//
// SECURITY: resultCode is INFORMATIONAL ONLY (docs: "Jangan menggunakan resultCode
// untuk mengupdate status pembayaran"). Payment status is confirmed exclusively via
// the server-to-server callback (/api/payment/callback). We redirect the user to the
// orders screen where the app fetches fresh status from the database.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const resultCode = searchParams.get('resultCode') || ''
  const merchantOrderId = searchParams.get('merchantOrderId') || ''
  const reference = searchParams.get('reference') || ''

  logger.info({ merchantOrderId, resultCode, reference }, 'Duitku return URL hit')

  // Map Duitku resultCode to a UI hint (informational only)
  const paymentHint =
    resultCode === '00' ? 'finish' : resultCode === '02' ? 'error' : 'pending'

  const target = `${getBaseUrl()}/?screen=orders&payment=${paymentHint}`
  return NextResponse.redirect(target, { status: 302 })
}
