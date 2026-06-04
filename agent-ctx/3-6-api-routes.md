# Task 3-6: API Routes - Viral Sorting, View Tracking, Promote Management

## Summary
Updated and created 4 API route files to support viral score sorting, product view tracking, and admin product promotion management.

## Work Done

### Task 1: Updated GET /api/products/route.ts
- Added `sort` query param support: `viral` (default), `newest`, `popular`, `promoted`
- **viral sort**: Uses raw SQL to compute viral score = `(sold * 3 + COALESCE(rating, 0) * reviewCount * 5 + viewCount * 0.1)`, sorts by viralScore DESC, createdAt DESC. Uses $queryRaw for IDs only, then fetches full products with Prisma include for seller/category/variants relations.
- **newest sort**: Current behavior (createdAt DESC)
- **popular sort**: orderBy sold DESC, rating DESC
- **promoted sort**: Filters where isPromoted=true AND promotedUntil > NOW(), then orderBy promotedUntil ASC (ending soon first)
- Added `isPromoted` filter: when `isPromoted=true` query param, filters promoted products
- Added `isFeatured` filter: when `isFeatured=true` query param, filters featured products
- Properly re-sorts Prisma results to match raw SQL viral order

### Task 2: Created POST /api/products/[id]/view/route.ts
- New endpoint for explicit view tracking
- Rate limited: max 1 view per product per IP per minute using checkRateLimit
- Increments viewCount and recalculates viralScore
- Returns updated viewCount and viralScore
- No auth required (public tracking)
- Returns `{ success: true, viewed: false }` on rate limit (not an error)

### Task 3: Created PUT /api/admin/products/promote/route.ts
- Admin-only endpoint (verifyAdmin) for product promotion management
- Accepts: productId (required), isPromoted (boolean, required), promotedDays (optional, default 30)
- When promoting: sets isPromoted=true, promotedUntil=NOW()+days, promotedBy=adminUserId
- When unpromoting: sets isPromoted=false, promotedUntil=null, promotedBy=null
- Creates notification to seller about promotion status change
- Returns updated product promotion data

### Task 4: Updated GET /api/products/[id]/route.ts
- Added non-blocking view tracking in the GET handler
- Rate limited: 1 view per IP per product per minute using checkRateLimit
- Uses fire-and-forget pattern (db.product.update().catch(() => {})) - doesn't await
- Increments viewCount and recalculates viralScore
- View tracking does not slow down the response

## Files Modified
- `src/app/api/products/route.ts` — Added viral sorting, promoted/featured filters
- `src/app/api/products/[id]/route.ts` — Added background view tracking
- `src/app/api/products/[id]/view/route.ts` — NEW: explicit view tracking endpoint
- `src/app/api/admin/products/promote/route.ts` — NEW: admin promote management

## Verification
- Lint passes ✅
- All imports verified against existing modules (db, auth-middleware, decimal-utils, logger)
