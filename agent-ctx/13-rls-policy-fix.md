# Task 13: RLS Policy Fix — Work Record

## Summary
Fixed Supabase RLS (Row Level Security) policies that were dangerously permissive (`USING (true) WITH CHECK (true)`), allowing anyone with the anon key to read/write all database tables. Replaced with service_role-only policies.

## Files Created
- `src/app/api/setup/rls/route.ts` — New admin-only endpoint for RLS policy management

## Files Modified
- `supabase-init.sql` — Updated all 27 RLS policies from permissive to service_role-only

## Key Decisions
- Used `auth.role() = 'service_role'` as the policy condition (standard Supabase pattern)
- Covered 39 tables total (27 from original init SQL + 12 newer tables from Prisma schema)
- POST endpoint executes DDL via Prisma's `$executeRawUnsafe` (Prisma connects as DB owner, bypasses RLS)
- GET endpoint returns SQL script for manual execution in Supabase SQL Editor
- Did NOT modify `setup/storage/route.ts` — it only creates policies on `storage.objects`, not public schema tables

## Impact
- Anon key (frontend JS) now has ZERO access to database tables
- Service role key (server-side only) retains full access
- Prisma (all API routes) unaffected — connects directly as DB owner, bypasses RLS
- Storage (file uploads) unaffected — separate `storage` schema with its own policies
