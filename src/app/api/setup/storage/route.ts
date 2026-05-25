import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'

/**
 * Setup Supabase Storage bucket for product uploads.
 * Creates the "products" bucket with public read access and upload policies.
 * Called once during app initialization.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdmin(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Dynamic import of pg to avoid issues
    const { Pool } = await import('pg')

    const directUrl = process.env.SUPABASE_DIRECT_URL
    if (!directUrl) {
      return NextResponse.json(
        { success: false, error: 'SUPABASE_DIRECT_URL not configured' },
        { status: 500 }
      )
    }

    const pool = new Pool({ connectionString: directUrl, max: 1 })

    try {
      // Create the products bucket if it doesn't exist
      await pool.query(`
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('products', 'products', true, 31457280, NULL)
        ON CONFLICT (id) DO NOTHING
      `)

      // Create RLS policies for the products bucket
      // Drop existing policies first to avoid conflicts
      const policies = [
        'DROP POLICY IF EXISTS "Public read access" ON storage.objects',
        'DROP POLICY IF EXISTS "Allow public upload" ON storage.objects',
        'DROP POLICY IF EXISTS "Allow public update" ON storage.objects',
        'DROP POLICY IF EXISTS "Allow public delete" ON storage.objects',
        `CREATE POLICY "Public read access" ON storage.objects
         FOR SELECT USING (bucket_id = 'products')`,
        `CREATE POLICY "Allow public upload" ON storage.objects
         FOR INSERT WITH CHECK (bucket_id = 'products')`,
        `CREATE POLICY "Allow public update" ON storage.objects
         FOR UPDATE USING (bucket_id = 'products')`,
        `CREATE POLICY "Allow public delete" ON storage.objects
         FOR DELETE USING (bucket_id = 'products')`,
      ]

      for (const sql of policies) {
        await pool.query(sql)
      }

      return NextResponse.json({
        success: true,
        message: 'Storage bucket "products" created with public access policies',
      })
    } finally {
      await pool.end()
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Storage setup error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
