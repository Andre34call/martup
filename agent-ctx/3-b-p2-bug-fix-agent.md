# Task 3-b: P2 Bug Fix Agent

## Summary
Fixed 3 P2 bugs: deprecated unused api.ts, unified cartItemInclude across 4 cart API routes, and removed unnecessary 'as any' casts from checkout-screen.tsx.

## Changes Made

### P2-1: Deprecate api.ts
- **File**: `src/lib/api.ts`
- **Change**: Added `@deprecated` JSDoc block at top of file
- **Verification**: Searched entire codebase for `from '@/lib/api'` — zero active imports found

### P2-2: Unify cartItemInclude
- **New export**: Added `parseCartItemFields()` to `src/lib/json-utils.ts`
- **4 files updated**:
  - `src/app/api/cart/route.ts` — removed local cartItemInclude, parseProductJsonFields, parseCartItemFields; imported from shared modules
  - `src/app/api/cart/add/route.ts` — removed local cartItemInclude (was inside handler); replaced inline JSON parsing with shared parseCartItemFields
  - `src/app/api/cart/[id]/route.ts` — removed local cartItemInclude; replaced inline JSON parsing with shared parseCartItemFields
  - `src/app/api/cart/bulk/route.ts` — removed local cartItemInclude and parseCartItemFields; imported from shared modules

### P2-8: Remove 'as any' casts
- **File**: `src/components/ecommerce/checkout-screen.tsx`
- **Change**: Replaced 5 instances of `(item.product as any).productType` with `item.product.productType`
- **Lines**: 389, 401, 518, 564, 991

## Verification
- `bun run lint` passes with no errors
