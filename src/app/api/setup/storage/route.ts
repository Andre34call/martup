import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// SECURITY: Hardcoded bucket IDs — these are the ONLY valid bucket identifiers.
// Never accept bucket IDs from user input to prevent SQL injection.
const BUCKET_IDS = ['products', 'avatars', 'banners', 'streams'] as const

/**
 * Setup Supabase Storage buckets for the application.
 * Creates all required buckets (products, avatars, banners, streams) with public read access and upload policies.
 * Called during app initialization.
 *
 * SECURITY: Admin-only endpoint. Only admin/manager users can trigger storage setup.
 * This endpoint executes raw SQL (DROP/CREATE POLICY), so it MUST be restricted.
 * The bucket IDs are hardcoded (not from user input) to prevent SQL injection.
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Only allow admin access — this route executes raw SQL
    const authResult = await verifyAdmin(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    try {
      // Create all required buckets if they don't exist
      // Bucket IDs are hardcoded — never from user input
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
      // SECURITY: bucketId is from hardcoded array only — safe from injection
      for (const bucketId of BUCKET_IDS) {
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
        message: 'Storage buckets (products, avatars, banners, streams) created with public access policies',
      })
    } catch (dbError: unknown) {
      const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error'
      logger.error({ err: errorMsg }, 'Storage setup DB error')
      // Don't leak DB error details to client
      return NextResponse.json(
        { success: false, error: 'Storage setup failed. Hubungi admin.' },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    logger.error({ err: error }, 'Storage setup error')
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
