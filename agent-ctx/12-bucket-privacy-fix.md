# Task 12 - bucket-privacy-fix Agent Work Log

## Task
Fix Supabase storage bucket security — make payments and deposits buckets private, create signed URL utility for accessing private files.

## Files Modified

1. `src/app/api/setup/storage/route.ts` — Changed deposits and payments to `public: false`, only create public read policy for public buckets
2. `src/lib/ensure-bucket.ts` — Added `public` option parameter (default `true`), added `allowedMimeTypes` safe defaults
3. `src/lib/signed-url.ts` — **NEW** — `generateSignedUrl()`, `generateSignedUrls()`, `PRIVATE_BUCKETS` set, `isPrivateBucket()` helper
4. `src/app/api/storage/signed-url/route.ts` — **NEW** — POST endpoint for signed URL generation with auth, rate limiting, validation
5. `src/app/api/upload/route.ts` — Returns `path` + `isPrivate` flag for private buckets (no `url`), passes `public: false` to ensureBucket
6. `src/hooks/api/use-upload.ts` — Updated `UploadResult` type: `url?` optional, added `isPrivate?`
7. `src/lib/upload.ts` — Updated `UploadResult` type: `url?` optional, added `isPrivate?`
8. `src/components/ecommerce/screens/deposit-detail-screen.tsx` — Updated deposit proof upload to use `proofPath` for private bucket
9. `src/app/api/wallet/deposits/[id]/proof/route.ts` — Accept `proofPath` in addition to `proofUrl`, construct reference URL from path for private buckets
10. `src/app/api/orders/[id]/payment-proof/route.ts` — Use `public: false` for payments bucket, generate signed URL in GET response

## Verification
- `bun run lint` passes with no errors
- Dev server compiles successfully
