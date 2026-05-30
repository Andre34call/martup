# Task 1-b: Fix CRITICAL Security Issues in Supabase Storage Setup

**Agent:** Security Fix Agent  
**File Modified:** `/home/z/my-project/src/app/api/setup/storage/route.ts`

## Issues Fixed

### 1. CB-4 / SG-9: Unauthenticated upload/update/delete
- **Before:** RLS policies for INSERT, UPDATE, DELETE only checked `bucket_id`, allowing anyone to upload/modify/delete files
- **After:** Added `AND auth.uid() IS NOT NULL` to all three policies, requiring authentication
- **Read policy unchanged:** SELECT remains public since product/avatar/banner images should be viewable by anyone

### 2. SG-1: SQL injection via $executeRawUnsafe
- **Before:** `bucketId` came from an inline array and was string-interpolated directly into SQL via `$executeRawUnsafe`
- **After:** 
  - Added `ALLOWED_BUCKETS` constant (`['products', 'avatars', 'banners']`)
  - Loop iterates over this typed constant
  - Runtime allowlist check before SQL execution
  - Since all values are from a fixed allowlist, injection is impossible

### 3. SG-10: No MIME type restrictions
- **Before:** `allowed_mime_types` was NULL for all buckets, allowing any file type upload
- **After:**
  - Added `ALLOWED_IMAGE_MIME_TYPES` constant with `['image/jpeg', 'image/png', 'image/webp', 'image/gif']`
  - `BUCKET_CONFIG` record maps each bucket to its file size limit and allowed MIME types
  - INSERT statement now sets `allowed_mime_types` using `ARRAY[...]` syntax
  - Changed `ON CONFLICT DO NOTHING` to `ON CONFLICT DO UPDATE SET` to update existing buckets with correct MIME types

## Verification
- `bun run lint` passes with no errors
- Dev server compiles successfully
