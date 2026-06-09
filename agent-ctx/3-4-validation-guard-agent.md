# Task 3 & 4: Shared Validation Module + API Route Guard

## Task 3: Enhanced Shared Validation Module

### What was done:
Enhanced `src/lib/validations.ts` with:

1. **Shared Validation Constants** (exported):
   - `MAX_PRICE_IDR = 1_000_000_000` — max price in IDR
   - `MAX_STOCK = 999_999` — max stock per product
   - `MAX_WEIGHT_GRAMS = 100_000` — max product weight
   - `MAX_MIN_ORDER = 999` — max minimum order quantity

2. **Reusable Zod Field Validators** (internal):
   - `priceField` — positive number, max 1 billion IDR
   - `stockField` — non-negative integer, max 999999
   - `weightField` — positive number, max 100000g
   - `minOrderField` — integer 1-999
   - `productVariantSchema` — with name, value, sku, price, stock, image
   - `productVariantUpdateSchema` — extends variant with optional id

3. **Enhanced Product Schemas**:
   - `productCreateSchema` — now includes all API route fields (sellerId, slug, videoUrl, tags, serviceDuration, serviceLocation, status), updated constraints (name max 200, description max 5000, price 1-1B, stock 0-999999, weight 1-100000, minOrder 1-999), fixed productType enum from ['barang','jasa'] to ['product','jasa'], added weight-required-for-non-jasa refine
   - `productUpdateSchema` — added productId field, same enhancements as create

4. **Enhanced Order Schema**:
   - `orderCreateSchema` — new schema with stricter validation (quantity max, note max 500 chars)
   - `createOrderSchema` and `updateOrderSchema` remain unchanged for backward compat

5. **Shared Validation Helpers** (exported):
   - `validatePrice(value)` — returns `{ valid: true, price }` or `{ valid: false, error }`
   - `validateStock(value)` — returns `{ valid: true, stock }` or `{ valid: false, error }`
   - `validateDiscount(price, discountPrice)` — returns `{ valid: true }` or `{ valid: false, error }`
   - `validateSlug(name)` — auto-generates URL-safe slug from name
   - `sanitizeString(value)` — trims, strips HTML tags, removes control chars

## Task 4: API Route Guard

### What was created:
`src/lib/api-guard.ts` — a reusable guard function for API routes.

### API Design:
```typescript
const guard = await apiGuard(request, {
  requireAuth: true,
  validateCsrf: true,
  rateLimit: { windowMs: 60000, maxRequests: 10, keyPrefix: 'rl:products:' },
  schema: productCreateSchema,
})

if (!guard.success) return guard.errorResponse
// guard.user — authenticated user
// guard.data — validated request body
```

### Features:
1. **Authentication** — calls `verifyAuth()` from `@/lib/auth-middleware`
2. **CSRF** — calls `validateCsrfRequest()` from `@/lib/csrf` (only for mutating methods)
3. **Rate Limiting** — uses `createRateLimiter()` from `@/lib/rate-limit` with configurable window, max requests, key prefix, and key suffix
4. **Body Validation** — parses JSON body and validates against Zod schema using `validateBody()`
5. **Consistent Error Responses** — all errors use `{ success: false, error: string }` format

### Helper Functions:
- `guardErrorResponse(error, status)` — create consistent error response
- `guardSuccessResponse(data, status)` — create consistent success response

### Backward Compatibility:
- Existing routes don't need to be refactored immediately
- The guard is opt-in — routes can adopt it incrementally
- All existing exports from validations.ts remain unchanged

## Verification:
- `bun run lint` passes with no errors
- Dev server running correctly on port 3000
