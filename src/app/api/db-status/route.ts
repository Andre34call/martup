import { NextResponse } from 'next/server'

// GET /api/db-status - Quick database connection diagnostic
// Uses a simple secret to prevent public access
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('s')

  if (secret !== 'mu2024') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const diag: Record<string, unknown> = {
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
  }

  // Check env vars (redacted)
  const dbUrl = process.env.DATABASE_URL || ''
  const supaUrl = process.env.SUPABASE_DATABASE_URL || ''
  diag.hasDbUrl = !!dbUrl
  diag.dbUrlPrefix = dbUrl ? dbUrl.substring(0, 20) + '...' : '(empty)'
  diag.hasSupaUrl = !!supaUrl
  diag.supaUrlPrefix = supaUrl ? supaUrl.substring(0, 20) + '...' : '(empty)'

  // Try connecting
  try {
    const { db } = await import('@/lib/db')
    const count = await db.user.count()
    diag.dbOk = true
    diag.userCount = count
  } catch (err: any) {
    diag.dbOk = false
    diag.errMsg = err?.message?.substring(0, 200) || 'Unknown error'
    diag.errType = err?.constructor?.name || 'Unknown'
    diag.errCode = err?.code || null
  }

  return NextResponse.json(diag)
}
