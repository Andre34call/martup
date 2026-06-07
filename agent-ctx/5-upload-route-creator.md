# Task 5 - Upload Route Creator

## Task
Create the missing `/api/upload` route at `src/app/api/upload/route.ts`

## Work Completed

### File Created
- `src/app/api/upload/route.ts` — Full-featured generic file upload route

### Implementation Details

**Security Features:**
1. **Authentication** — Uses `verifyAuth` + `authErrorResponse` from `@/lib/auth-middleware`
2. **Rate Limiting** — 20 uploads/minute per user via `createRateLimiter` from `@/lib/rate-limit`
3. **Bucket Whitelist** — Only allows: products, avatars, banners, streams, reviews, deposits, payments
4. **File Type Validation** — Uses `UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES` and `UPLOAD_LIMITS.ALLOWED_VIDEO_TYPES`
5. **Image-Only Restriction** — `payments` and `deposits` buckets reject video uploads
6. **Magic Byte Validation** — Images (JPEG, PNG, GIF, WebP) and Videos (MP4 ftyp, WebM EBML, MOV moov/mdat)
7. **Extension Sanitization** — Only safe extensions allowed; fallback to safe defaults
8. **Per-Bucket Size Limits** — Uses `UPLOAD_LIMITS` constants with bucket-specific max sizes
9. **No Internal Error Leakage** — Generic error messages to client, detailed logging server-side

**Functional Features:**
1. **FormData Fields** — `file` (required), `bucket` (optional, default 'products'), `folder` (optional, default 'images')
2. **Auto Bucket Creation** — Uses `ensureBucket` from `@/lib/ensure-bucket` when bucket not found
3. **Unique Filenames** — `Date.now() + crypto.randomUUID()` segment
4. **Supabase REST API** — Upload via service role key, bypasses RLS
5. **Response Format** — `{ success: true, data: { url, path, type } }`
6. **Structured Logging** — Uses `logger` from `@/lib/logger` for all operations

### Client Compatibility
- Compatible with `uploadFile()` from `src/lib/upload.ts`
- Compatible with `useUpload()` hook from `src/hooks/api/use-upload.ts`
- Both clients send `file`, `bucket`, `folder` via FormData to `/api/upload`

### Verification
- `bun run lint`: passes with no errors
- Dev server: running correctly on port 3000
