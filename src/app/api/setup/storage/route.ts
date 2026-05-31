import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// SECURITY: Hardcoded bucket definitions — the ONLY valid bucket identifiers.
// Never accept bucket IDs from user input to prevent SQL injection.
const BUCKETS = [
  { id: 'products', maxSize: 31457280 },   // 30MB
  { id: 'avatars', maxSize: 10485760 },     // 10MB
  { id: 'banners', maxSize: 10485760 },     // 10MB
  { id: 'streams', maxSize: 52428800 },     // 50MB
] as const

/**
 * Setup Supabase Storage buckets for the application.
 * Creates all required buckets with public read access and authenticated-only upload policies.
 * Called during app initialization.
 *
 * SECURITY:
 * - Admin-only endpoint. Only admin/manager users can trigger storage setup.
 * - Bucket IDs are hardcoded (never from user input) to prevent SQL injection.
 * - RLS policies restrict uploads/updates/deletes to authenticated users only.
 * - Public read access is allowed for all buckets (CDN-style access).
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
      // Using parameterized VALUES where possible; bucket IDs are hardcoded constants
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
      // SECURITY: Upload/Update/Delete policies require authenticated users (auth.uid() IS NOT NULL)
      // This prevents anonymous uploads while allowing public read access
      for (const { id: bucketId } of BUCKETS) {
        const policies = [
          // Drop existing policies (idempotent setup)
          `DROP POLICY IF EXISTS "${bucketId}_public_read" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_auth_upload" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_auth_update" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_auth_delete" ON storage.objects`,
          // Also drop old public policies if upgrading from a previous version
          `DROP POLICY IF EXISTS "${bucketId}_public_upload" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_public_update" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_public_delete" ON storage.objects`,
          // Create new policies: public read + authenticated-only write
          `CREATE POLICY "${bucketId}_public_read" ON storage.objects
           FOR SELECT USING (bucket_id = '${bucketId}')`,
          `CREATE POLICY "${bucketId}_auth_upload" ON storage.objects
           FOR INSERT WITH CHECK (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
          `CREATE POLICY "${bucketId}_auth_update" ON storage.objects
           FOR UPDATE USING (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
          `CREATE POLICY "${bucketId}_auth_delete" ON storage.objects
           FOR DELETE USING (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
        ]

        for (const sql of policies) {
          try {
            await db.$executeRawUnsafe(sql)
          } catch (policyErr) {
            // Log but don't fail — some policies may already exist
            logger.warn({ bucketId, sql: sql.substring(0, 60), err: String(policyErr) }, 'Policy setup warning')
          }
        }
      }

      // Clean up legacy policies that use generic names
      const legacyPolicies = [
        'DROP POLICY IF EXISTS "Public read access" ON storage.objects',
        'DROP POLICY IF EXISTS "Allow public upload" ON storage.objects',
        'DROP POLICY IF EXISTS "Allow public update" ON storage.objects',
        'DROP POLICY IF EXISTS "Allow public delete" ON storage.objects',
      ]
      for (const sql of legacyPolicies) {
        try { await db.$executeRawUnsafe(sql) } catch { /* ignore */ }
      }

      logger.info({ buckets: BUCKETS.map(b => b.id) }, 'Storage buckets created with authenticated-write policies')

      return NextResponse.json({
        success: true,
        message: 'Storage buckets (products, avatars, banners, streams) created with public read + authenticated write policies',
      })
    } catch (dbError: unknown) {
      const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error'
      logger.error({ err: errorMsg }, 'Storage setup DB error')
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
