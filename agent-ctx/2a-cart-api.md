# Task 2a - Cart API Backend

## Summary
Created `/home/z/my-project/src/app/api/cart/route.ts` - a comprehensive Cart API backend with 6 operations.

## API Endpoints

### GET /api/cart
- Auth required, userId query param must match auth user
- Returns cart items with product details (seller, category, variants)
- Parses product JSON fields (images, tags)
- Uses serializeDecimal for Decimal fields

### POST /api/cart (Add item)
- Auth required, rate limited 30/min
- Body: `{ productId, variantId?, quantity }`
- Validates product exists/active, variant belongs to product
- Stock check (existing cart qty + new qty vs available)
- Upsert: same userId+productId+variantId → increment quantity
- Max quantity: 99
- Returns 201 (new) or 200 (updated)

### POST /api/cart?merge=true (Merge cart)
- Auth required, rate limited 30/min
- Body: `{ items: Array<{ productId, variantId?, quantity }> }`
- Upserts each item (add quantities), skips invalid items silently
- Returns merged items with count

### POST /api/cart?clear=true (Clear cart)
- Auth required
- Deletes all cart items for user

### PUT /api/cart (Update item)
- Auth required
- Body: `{ cartItemId, quantity?, isChecked? }`
- Ownership verification (403 if not owner)
- Stock check for quantity updates, max 99

### DELETE /api/cart (Remove items)
- Auth required
- Body: `{ cartItemId }` or `{ cartItemId: string[] }` for batch
- Ownership verification for all items
- Returns deleted count

## Patterns Followed
- Auth: `verifyAuth` + `authErrorResponse` from `@/lib/auth-middleware`
- Rate limiting: `checkRateLimit` from same module
- JSON parsing: `parseJsonField` + `parseProductJsonFields` helpers
- Decimal serialization: `serializeDecimal` from `@/lib/decimal-utils`
- DB: `import { db } from '@/lib/db'`
- Response format: `{ success: true/false, data/error: ... }`
