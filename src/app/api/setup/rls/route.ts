import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, authErrorResponse } from '@/lib/auth-middleware'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// ==================== CONFIG ====================

/**
 * All tables in the public schema that should have RLS policies.
 * These correspond to the tables created by Prisma migrations.
 */
const PUBLIC_SCHEMA_TABLES = [
  'User',
  'Seller',
  'Address',
  'Wallet',
  'WalletMutation',
  'Deposit',
  'Withdrawal',
  'Transaction',
  'Category',
  'Product',
  'ProductVariant',
  'CartItem',
  'Order',
  'OrderItem',
  'Shipping',
  'Review',
  'Wishlist',
  'ChatRoom',
  'ChatParticipant',
  'ChatMessage',
  'Notification',
  'Voucher',
  'VoucherUsage',
  'Campaign',
  'Banner',
  'Complaint',
  'Referral',
  'Division',
  'WorkItem',
  'PlatformBankAccount',
  'PlatformSetting',
  'UserSetting',
  'StreamPost',
  'StreamComment',
  'StreamLike',
  'StreamCommentLike',
  'StreamPostReport',
  'BuyerRating',
  'FollowedStore',
]

// ==================== SQL GENERATION ====================

/**
 * Generate SQL to secure all public schema tables by:
 * 1. Dropping the permissive `USING (true) WITH CHECK (true)` policies
 * 2. Creating new policies that only allow access via service_role
 *
 * This is safe because:
 * - Prisma connects directly to PostgreSQL as the database owner (bypasses RLS entirely)
 * - API routes use Prisma, so they are unaffected by RLS policies
 * - The Supabase JS client (anon key) is only used for Storage, not database queries
 * - Storage bucket policies are in the `storage` schema, not `public`, so they are untouched
 */
function generateSecureRLSSql(): string {
  const statements: string[] = []

  for (const table of PUBLIC_SCHEMA_TABLES) {
    const policyName = `Service role full access on ${table}`

    // Drop the permissive policy if it exists
    statements.push(
      `DROP POLICY IF EXISTS "${policyName}" ON "${table}";`
    )

    // Create a policy that only allows access via service_role
    // auth.role() returns the role of the current Supabase Auth user
    // 'service_role' is the server-side role that bypasses RLS (but we still set the policy)
    // 'anon' is the public role used by the Supabase JS client with the anon key
    statements.push(
      `CREATE POLICY "${policyName}" ON "${table}" FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');`
    )
  }

  return statements.join('\n\n')
}

/**
 * Generate SQL to verify current RLS policies (for diagnostics).
 * This queries pg_policies to show what policies exist on public schema tables.
 */
function generateDiagnosticSql(): string {
  return `
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
  `.trim()
}

/**
 * Generate the full secure SQL script with comments for manual execution.
 */
function generateFullScript(): string {
  const header = `-- ====================================================================
-- MartUp RLS Security Fix
-- Generated: ${new Date().toISOString()}
--
-- PURPOSE: Replace permissive USING (true) WITH CHECK (true) policies
--          with service_role-only policies on all public schema tables.
--
-- WHY: The original supabase-init.sql created policies that allow
--      ANYONE with the anon key to read/write all data. This script
--      restricts database table access to service_role only.
--
-- IMPORTANT:
-- - Prisma (used by all API routes) connects directly to PostgreSQL
--   as the database owner, bypassing RLS entirely. These policies
--   will NOT affect your application's API routes.
-- - The Supabase JS client on the frontend uses the anon key, which
--   only needs Storage access (file uploads). This script blocks
--   anon key access to all database tables.
-- - Storage bucket policies (in the 'storage' schema) are NOT
--   affected by this script.
--
-- HOW TO RUN:
-- 1. Open Supabase Dashboard > SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ====================================================================

-- First, ensure RLS is enabled on all tables
-- (These are no-ops if RLS is already enabled)`

  const enableRlsStatements = PUBLIC_SCHEMA_TABLES.map(
    table => `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`
  ).join('\n')

  const securePolicies = `

-- ====================================================================
-- Drop permissive policies and create secure ones
-- ====================================================================

${generateSecureRLSSql()}

-- ====================================================================
-- Verification query (run separately to check current policies)
-- ====================================================================
-- ${generateDiagnosticSql().split('\n').join('\n-- ')}
`

  return header + '\n\n' + enableRlsStatements + securePolicies
}

// ==================== POST /api/setup/rls ====================
// Executes the RLS security fix directly via Prisma.
// Must be called by an authenticated admin.
// This is idempotent — safe to call multiple times.

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication
    const authResult = await verifyAdmin(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    logger.info({ userId: authResult.user.id, role: authResult.user.role }, 'RLS setup initiated by admin')

    // Check if we're using PostgreSQL (Prisma with Supabase)
    const databaseUrl = process.env.DATABASE_URL || ''
    const supabaseDbUrl = process.env.SUPABASE_DATABASE_URL || ''
    const isPostgres = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://') ||
                       supabaseDbUrl.startsWith('postgresql://') || supabaseDbUrl.startsWith('postgres://')

    if (!isPostgres) {
      return NextResponse.json(
        {
          success: false,
          error: 'RLS setup hanya tersedia untuk database PostgreSQL (Supabase). Database saat ini bukan PostgreSQL.',
          suggestion: 'Gunakan endpoint GET /api/setup/rls untuk mendapatkan SQL script yang bisa dijalankan manual di Supabase SQL Editor.',
        },
        { status: 400 }
      )
    }

    const sql = generateSecureRLSSql()
    const results: Array<{ table: string; action: string; success: boolean; error?: string }> = []

    // Execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0)

    for (const statement of statements) {
      const trimmed = statement.trim()
      if (!trimmed) continue

      // Parse table name from statement for logging
      const dropMatch = trimmed.match(/DROP POLICY.*ON\s+"(\w+)"/i)
      const createMatch = trimmed.match(/CREATE POLICY.*ON\s+"(\w+)"/i)
      const tableName = dropMatch?.[1] || createMatch?.[1] || 'unknown'
      const action = trimmed.startsWith('DROP') ? 'drop_policy' : 'create_policy'

      try {
        await db.$executeRawUnsafe(trimmed)
        results.push({ table: tableName, action, success: true })
        logger.info({ table: tableName, action }, 'RLS policy updated')
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        results.push({ table: tableName, action, success: false, error: errorMsg })
        logger.error({ table: tableName, action, error: errorMsg }, 'RLS policy update failed')
      }
    }

    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      success: failed === 0,
      message: `RLS setup selesai: ${succeeded} statement berhasil, ${failed} gagal`,
      data: {
        totalStatements: results.length,
        succeeded,
        failed,
        details: results,
      },
      note: 'Prisma (API routes) tidak terpengaruh oleh RLS karena koneksi langsung ke PostgreSQL sebagai database owner.',
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'RLS setup error')
    return NextResponse.json(
      { success: false, error: 'Gagal mengatur RLS policies' },
      { status: 500 }
    )
  }
}

// ==================== GET /api/setup/rls ====================
// Returns the SQL script to secure RLS policies.
// Admin can copy this and run it in Supabase SQL Editor.

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication
    const authResult = await verifyAdmin(request)
    if (!authResult.success) {
      return authErrorResponse(authResult)
    }

    // Check if the client wants the raw SQL script (for download/copy)
    const acceptHeader = request.headers.get('accept') || ''
    const wantsRawSql = acceptHeader.includes('text/plain') ||
                        request.nextUrl.searchParams.get('format') === 'sql'

    if (wantsRawSql) {
      // Return raw SQL script
      const script = generateFullScript()
      return new NextResponse(script, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'attachment; filename="secure-rls-policies.sql"',
        },
      })
    }

    // Return JSON with the SQL script and diagnostic info
    const script = generateFullScript()
    const securePolicySql = generateSecureRLSSql()
    const diagnosticSql = generateDiagnosticSql()

    return NextResponse.json({
      success: true,
      message: 'SQL script untuk mengamankan RLS policies. Jalankan di Supabase SQL Editor.',
      data: {
        sqlScript: securePolicySql,
        fullScript: script,
        diagnosticSql,
        tableCount: PUBLIC_SCHEMA_TABLES.length,
        tables: PUBLIC_SCHEMA_TABLES,
        instructions: [
          '1. Buka Supabase Dashboard > SQL Editor',
          '2. Paste SQL script dari field "fullScript"',
          '3. Klik "Run"',
          '4. Gunakan diagnosticSql untuk memverifikasi policies sudah benar',
          '',
          'ATAU: Panggil POST /api/setup/rls untuk mengeksekusi langsung dari API.',
        ],
      },
    })
  } catch (error: unknown) {
    logger.error({ err: error }, 'RLS script generation error')
    return NextResponse.json(
      { success: false, error: 'Gagal generate RLS script' },
      { status: 500 }
    )
  }
}
