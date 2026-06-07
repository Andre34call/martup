Task ID: 3-b
Agent: Reviews Route Refactor Agent
Task: Refactor src/app/api/reviews/route.ts to use apiGuard and Zod schemas

Work Log:
- Read worklog.md for previous context
- Read current reviews route, api-guard.ts, validations.ts, api-utils.ts
- Identified all imports and logic to change

Refactoring Applied (src/app/api/reviews/route.ts):

1. Imports Changed:
   - REMOVED: `verifyAuth` from `@/lib/auth-middleware` (guard handles auth)
   - REMOVED: `createRateLimiter` from `@/lib/rate-limit` (guard handles rate limiting)
   - REMOVED: `reviewCreateLimiter` constant (guard creates limiter from config)
   - REMOVED: `successResponse` from api-utils (kept `errorResponse` and `parseJsonField`)
   - ADDED: `z` from 'zod' (for type inference)
   - ADDED: `apiGuard` from `@/lib/api-guard`
   - ADDED: `reviewCreateSchema`, `reviewUpdateSchema`, `reviewDeleteSchema` from `@/lib/validations`
   - ADDED: Type aliases: `ReviewCreateInput`, `ReviewUpdateInput`, `ReviewDeleteInput`

2. GET Handler (no guard — public endpoint):
   - Replaced manual `NextResponse.json({ success: false, error: ... }, { status: ... })` with `errorResponse(...)`
   - No other changes to business logic

3. POST Handler:
   - Replaced `verifyAuth` + manual rate limit check + manual body parsing + manual validation
   - With: `apiGuard<ReviewCreateInput>(request, { auth: 'user', rateLimit: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:reviews:create:' }, schema: reviewCreateSchema })`
   - Guard handles: auth, rate limiting, CSRF, body validation
   - Removed: manual productId/orderItemId/rating/content length validations (Zod handles these)
   - Kept: `sanitizeInput(body.content)` for XSS protection (Zod only validates length)
   - Kept: product existence check, orderItem ownership, order status validation, duplicate review check, rating recalculation
   - Changed: `authResult.user.id` → `user!.id` (non-null assertion since auth='user' guarantees user exists)

4. PUT Handler:
   - With: `apiGuard<ReviewUpdateInput>(request, { auth: 'user', schema: reviewUpdateSchema })`
   - Removed: manual reviewId/rating/content validations (Zod handles these)
   - Kept: ownership check, `sanitizeInput(content)`, rating recalculation
   - Simplified: `images` array check (Zod already validates it's an array)

5. DELETE Handler:
   - With: `apiGuard<ReviewDeleteInput>(request, { auth: 'user', schema: reviewDeleteSchema })`
   - Removed: manual reviewId validation (Zod handles this)
   - Kept: ownership check, product ID check, rating recalculation

Business Logic Preserved:
- All ownership checks (user can only modify/delete their own reviews)
- Product existence check on create
- OrderItem ownership and order status ('delivered') validation
- Duplicate review prevention (one review per orderItem)
- Rating recalculation (product + seller) on create/update/delete
- Indonesian error messages
- `sanitizeInput` for XSS protection on content
- `serializeDecimal` for Decimal field serialization
- `parseJsonField` for images JSON parsing

Verification:
- `bun run lint` passes with no errors
- Dev server running correctly on port 3000
