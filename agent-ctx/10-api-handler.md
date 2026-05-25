# Task 10: Add PUT and DELETE handlers to Seller Products API

## Agent: api-handler

## Summary
Added PUT and DELETE handlers to `/home/z/my-project/src/app/api/seller/products/route.ts` while preserving existing GET and POST handlers.

## Changes Made

### File Modified: `src/app/api/seller/products/route.ts`

1. **Added import**: `verifyAuth, authErrorResponse, checkRateLimit` from `@/lib/auth-middleware`

2. **PUT handler** - Update a product:
   - Authentication via `verifyAuth` (required)
   - Rate limit: 20 ops/min per user
   - Input validation: productId required, numeric bounds (price >= 0, stock >= 0, etc.), enum validation (condition, status)
   - Ownership verification: product.sellerId must match authenticated user's seller record
   - Slug uniqueness check on update
   - JSON field stringification (images, tags) before save
   - JSON field parsing in response
   - Variants update: replaces all existing variants in a transaction
   - Seller totalProducts count updated on status change (active ↔ non-active)
   - Atomic via Prisma `$transaction`

3. **DELETE handler** - Soft delete a product:
   - Authentication via `verifyAuth` (required)
   - Rate limit: 20 ops/min per user
   - Input validation: productId required
   - Ownership verification: product.sellerId must match authenticated user's seller record
   - Soft delete: sets status to 'blocked' (preserves referential integrity)
   - Already-deleted check (returns 400 if already blocked)
   - Seller totalProducts count decremented only if product was active
   - Atomic via Prisma `$transaction`

## Security Features
- Both handlers require `verifyAuth` authentication
- Seller can only edit/delete their OWN products (sellerId ownership check)
- Rate limiting: max 20 operations per minute per user
- Input validation for all numeric fields and enum values
- No hard deletes — soft delete preserves referential integrity

## Lint Status
✅ All lint checks pass, no errors or warnings
