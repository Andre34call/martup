import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/db-test - Quick database connection test
// Only available in development or with a secret key in production
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // In production, require a secret key
  if (process.env.NODE_ENV === 'production' && secret !== 'martup-db-test-2024') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  try {
    // Try a simple query
    const userCount = await db.user.count()
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      userCount,
      provider: 'postgresql',
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPrefix: (process.env.DATABASE_URL || '').substring(0, 15) + '...',
      hasSupabaseUrl: !!process.env.SUPABASE_DATABASE_URL,
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error',
      errorType: error?.constructor?.name || 'Unknown',
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPrefix: (process.env.DATABASE_URL || '').substring(0, 15) + '...',
      hasSupabaseUrl: !!process.env.SUPABASE_DATABASE_URL,
    }, { status: 500 })
  }
}
