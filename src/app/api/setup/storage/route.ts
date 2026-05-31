import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'

import { logger } from '@/lib/logger'
/**
 * Setup Supabase Storage buckets for the application.
 * Creates all required buckets (products, avatars, banners) with public read access and upload policies.
 * Called during app initialization.
 *
 * SECURITY (SEC-12): Admin-only endpoint. Only admin users can trigger storage setup.
 */
export async function POST(request: NextRequest) {
  try {
    // SEC-12: Only allow admin access — no fallback to regular auth
    const authResult = await verifyAdmin(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Use Prisma's raw query instead of pg Pool to avoid dependency issues
    try {
      // Create all required buckets if they don't exist
      await db.$executeRawUnsafe(`
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES
          ('products', 'products', true, 31457280, NULL),
          ('avatars', 'avatars', true, 10485760, NULL),
          ('banners', 'banners', true, 10485760, NULL),
          ('streams', 'streams', true, 52428800, NULL)
        ON CONFLICT (id) DO NOTHING
      `)

      // Create RLS policies for all buckets
      // Each bucket gets: public read, upload, update, delete policies
      const bucketIds = ['products', 'avatars', 'banners', 'streams']

      for (const bucketId of bucketIds) {
        const policies = [
          `DROP POLICY IF EXISTS "${bucketId}_public_read" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_public_upload" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_public_update" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_public_delete" ON storage.objects`,
          `CREATE POLICY "${bucketId}_public_read" ON storage.objects
           FOR SELECT USING (bucket_id = '${bucketId}')`,
          `CREATE POLICY "${bucketId}_public_upload" ON storage.objects
           FOR INSERT WITH CHECK (bucket_id = '${bucketId}')`,
          `CREATE POLICY "${bucketId}_public_update" ON storage.objects
           FOR UPDATE USING (bucket_id = '${bucketId}')`,
          `CREATE POLICY "${bucketId}_public_delete" ON storage.objects
           FOR DELETE USING (bucket_id = '${bucketId}')`,
        ]

        for (const sql of policies) {
          await db.$executeRawUnsafe(sql)
        }
      }

      // Also clean up any legacy policies that use generic names
      const legacyPolicies = [
        'DROP POLICY IF EXISTS "Public read access" ON storage.objects',
        'DROP POLICY IF EXISTS "Allow public upload" ON storage.objects',
        'DROP POLICY IF EXISTS "Allow public update" ON storage.objects',
        'DROP POLICY IF EXISTS "Allow public delete" ON storage.objects',
      ]
      for (const sql of legacyPolicies) {
        try { await db.$executeRawUnsafe(sql) } catch { /* ignore */ }
      }

      return NextResponse.json({
        success: true,
        message: 'Storage buckets (products, avatars, banners) created with public access policies',
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
    // Error logged above — generic message returned to client
    logger.error({ err: error }, 'Storage setup error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
