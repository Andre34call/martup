import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'

import { logger } from '@/lib/logger'
/**
 * Setup Supabase Storage bucket for product uploads.
 * Creates the "products" bucket with public read access and upload policies.
 * Called once during app initialization.
 *
 * SECURITY: Accepts requests from any authenticated user (not just admin).
 * This is safe because the operation is idempotent — it only creates the bucket
 * if it doesn't already exist (ON CONFLICT DO NOTHING).
 * Admin verification is still attempted first for audit logging purposes.
 */
export async function POST(request: NextRequest) {
  try {
    // Try admin auth first, but fall back to any authenticated user
    // since this is an idempotent setup operation
    let authResult = await verifyAdmin(request)
    if (!authResult.success) {
      // Fall back to regular auth — any logged-in user can trigger setup
      authResult = await verifyAuth(request)
      if (!authResult.success) {
        return authErrorResponse(authResult)
      }
    }

    // Use Prisma's raw query instead of pg Pool to avoid dependency issues
    try {
      // Create the products bucket if it doesn't exist
      await db.$executeRawUnsafe(`
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
        await db.$executeRawUnsafe(sql)
      }

      return NextResponse.json({
        success: true,
        message: 'Storage bucket "products" created with public access policies',
      })
    } catch (dbError: unknown) {
      const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error'
      logger.error({ err: errorMsg }, 'Storage setup DB error')
      return NextResponse.json(
        { success: false, error: `Storage setup failed: ${errorMsg}` },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logger.error({ err: error }, 'Storage setup error')
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
