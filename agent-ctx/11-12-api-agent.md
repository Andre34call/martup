---
Task ID: 11-12
Agent: api-agent
Task: Update Categories API + Create Voucher Validation API

Work Log:

### Task 11: Update Categories API

- Read existing `/src/app/api/categories/route.ts` (flat list of categories with productCount)
- Rewrote GET handler to support hierarchical category structure:
  - Added `parentId` query parameter support:
    - `?parentId=null` → returns root categories (parentId = null)
    - `?parentId=<categoryId>` → returns children of that category
    - No parentId → returns root categories with fully nested children
  - Included nested `children` relation up to 4 levels deep with product counts
  - Created recursive `transformCategory()` helper to convert Prisma's `_count` to `productCount` and nest children
  - Maintained `isActive: true` filter on all levels
  - Maintained `sortOrder: asc` ordering on all levels
  - Response format matches the spec: `{ success, data: [{ id, name, slug, icon, parentId, productCount, children: [...] }] }`

### Task 12: Create Voucher Validation API

Created 2 new files:

1. **`/src/app/api/vouchers/route.ts`** (Public endpoint)
   - GET: Lists active vouchers within valid date range
   - Optional `userId` query param to check usage status per voucher
   - Returns `isAvailable`, `userCanUse`, `remainingUses`, `userRemainingUses` computed fields
   - No auth required (public browsing)

2. **`/src/app/api/vouchers/validate/route.ts`** (Authenticated endpoint)
   - **POST**: Validates a voucher code with all 6 validation checks:
     1. Voucher exists and isActive
     2. Voucher within valid date range (validFrom <= now <= validUntil)
     3. Cart subtotal meets minPurchase requirement
     4. Voucher usageLimit not exceeded
     5. User perUserLimit not exceeded (via VoucherUsage count)
     6. Seller-specific voucher check (sellerId match)
   - Calculates discount amount (percentage with maxDiscount cap, or fixed)
   - Rounds discount to integer Rupiah, ensures it doesn't exceed cart subtotal
   - Rate limited: max 10 per minute per user (via checkRateLimit)
   - Auth required: verifyAuth checks user identity, ensures authenticated userId matches request userId
   - Returns `{ valid: true, voucher, discountAmount, message }` or `{ valid: false, message }`
   - **GET**: Lists available vouchers for a specific user
     - Requires auth (verifyAuth), validates userId matches authenticated user
     - Optional `sellerId` filter (returns platform vouchers + matching seller vouchers)
     - Includes user usage status and availability flags
   - All error messages in Indonesian (matching project locale)

### Security
- verifyAuth on all authenticated endpoints
- Rate limiting on voucher validation POST
- User ID verification (authenticated user must match request userId)
- Input validation for all required fields

Stage Summary:
- Categories API now returns hierarchical nested structure with sub-categories
- Voucher listing (public) and validation (authenticated) APIs fully implemented
- All validation checks implemented per spec
- Lint check passes (0 errors)
