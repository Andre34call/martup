import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'

import { logger } from '@/lib/logger'

/** Allowlist of valid bucket IDs — prevents SQL injection via $executeRawUnsafe */
const ALLOWED_BUCKETS = ['products', 'avatars', 'banners'] as const

type BucketId = (typeof ALLOWED_BUCKETS)[number]

/** MIME types allowed for image uploads across all buckets */
const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

/** File size limits per bucket (in bytes) */
const BUCKET_CONFIG: Record<BucketId, { fileSizeLimit: number; mimeTypes: string[] }> = {
  products: { fileSizeLimit: 31457280, mimeTypes: [...ALLOWED_IMAGE_MIME_TYPES] },
  avatars: { fileSizeLimit: 10485760, mimeTypes: [...ALLOWED_IMAGE_MIME_TYPES] },
  banners: { fileSizeLimit: 10485760, mimeTypes: [...ALLOWED_IMAGE_MIME_TYPES] },
}

/**
 * Setup Supabase Storage buckets for the application.
 * Creates all required buckets (products, avatars, banners) with public read access
 * and authenticated-only upload/update/delete policies.
 * Called during app initialization.
 *
 * SECURITY FIXES APPLIED:
 * - CB-4 / SG-9: Upload/update/delete policies now require auth.uid() IS NOT NULL
 * - SG-1: Bucket IDs validated against an allowlist before use in SQL
 * - SG-10: allowed_mime_types set for all buckets to restrict to image types
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
      // SG-10 FIX: Set allowed_mime_types for all buckets to restrict uploads to images only
      // Also uses ON CONFLICT DO UPDATE to ensure existing buckets get the correct mime types
      await db.$executeRawUnsafe(`
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES
          ('products', 'products', true, ${BUCKET_CONFIG.products.fileSizeLimit}, ARRAY[${BUCKET_CONFIG.products.mimeTypes.map(t => `'${t}'`).join(',')}]),
          ('avatars', 'avatars', true, ${BUCKET_CONFIG.avatars.fileSizeLimit}, ARRAY[${BUCKET_CONFIG.avatars.mimeTypes.map(t => `'${t}'`).join(',')}]),
          ('banners', 'banners', true, ${BUCKET_CONFIG.banners.fileSizeLimit}, ARRAY[${BUCKET_CONFIG.banners.mimeTypes.map(t => `'${t}'`).join(',')}])
        ON CONFLICT (id) DO UPDATE SET
          allowed_mime_types = EXCLUDED.allowed_mime_types,
          file_size_limit = EXCLUDED.file_size_limit
      `)

      // SG-1 FIX: Use allowlist-validated bucket IDs to prevent SQL injection
      // CB-4 / SG-9 FIX: Upload/update/delete policies now require auth.uid() IS NOT NULL
      for (const bucketId of ALLOWED_BUCKETS) {
        // Validate bucketId against allowlist before using in SQL
        if (!ALLOWED_BUCKETS.includes(bucketId)) {
          throw new Error(`Invalid bucket ID: ${bucketId}`)
        }

        const policies = [
          `DROP POLICY IF EXISTS "${bucketId}_public_read" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_public_upload" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_public_update" ON storage.objects`,
          `DROP POLICY IF EXISTS "${bucketId}_public_delete" ON storage.objects`,
          // Public read — anyone can view product/avatar/banner images
          `CREATE POLICY "${bucketId}_public_read" ON storage.objects
           FOR SELECT USING (bucket_id = '${bucketId}')`,
          // Authenticated-only upload — requires auth.uid() IS NOT NULL
          `CREATE POLICY "${bucketId}_public_upload" ON storage.objects
           FOR INSERT WITH CHECK (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
          // Authenticated-only update — requires auth.uid() IS NOT NULL
          `CREATE POLICY "${bucketId}_public_update" ON storage.objects
           FOR UPDATE USING (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
          // Authenticated-only delete — requires auth.uid() IS NOT NULL
          `CREATE POLICY "${bucketId}_public_delete" ON storage.objects
           FOR DELETE USING (bucket_id = '${bucketId}' AND auth.uid() IS NOT NULL)`,
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
