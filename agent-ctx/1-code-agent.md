# Task 1 - Code Agent: Create 5 new admin API routes + auth middleware helper

## Summary
Created 6 files total: 1 admin auth middleware helper + 5 admin API route files.

## Files Created

### 1. `/src/lib/admin-auth.ts`
- `requireAdmin()` function that validates admin access
- Checks NextAuth session via `getServerSession(authOptions)`
- Looks up user in DB by email and verifies `role === 'admin'`
- Returns the user object if admin, or `null` if not

### 2. `/src/app/api/admin/categories/route.ts`
- **GET**: List categories with product count & children count, supports `?parentId=` filter (including `parentId=null` for root categories)
- **POST**: Create category with auto-slugify from name, validates slug uniqueness
- **PUT**: Update category by categoryId, auto-regenerates slug if name changes
- **DELETE**: Soft delete by setting `isActive=false`

### 3. `/src/app/api/admin/vouchers/route.ts`
- **GET**: List vouchers with usage count & seller store name
- **POST**: Create voucher with validation (code, name, type, value, validFrom, validUntil required), checks code uniqueness, auto-uppercases code
- **PUT**: Update voucher by voucherId
- **DELETE**: Hard delete with cascade (deletes related VoucherUsage records first)

### 4. `/src/app/api/admin/deposits/route.ts`
- **GET**: List deposits with user info (name, email, phone, avatar), supports `?status=pending` filter
- **PUT**: Update deposit status (success/failed) with wallet crediting logic:
  - Validates deposit exists and is currently pending
  - On approval: finds user's wallet, credits balance, creates WalletMutation record
  - Handles case where wallet doesn't exist by creating it
  - Prevents double-processing of already-handled deposits

### 5. `/src/app/api/admin/campaigns/route.ts`
- **GET**: List campaigns with seller info, supports `?status=active`/`?status=inactive` filter, includes computed `isExpired`/`isUpcoming` flags
- **PUT**: Update campaign (approve/reject via `isActive`), creates notification for seller about campaign status change

### 6. `/src/app/api/admin/settings/route.ts`
- **GET**: Returns platform settings from JSON file with sensible defaults
- **PUT**: Updates platform settings, validates numeric/boolean types
- Uses `admin-settings.json` file for persistence (avoids Prisma schema changes)
- 14 configurable settings: commissionRate, minWithdrawal, platformFee, maxProductImages, maxProductVariants, voucherEnabled, depositEnabled, campaignEnabled, chatEnabled, reviewEnabled, referralReward, loyaltyPointsRate, flashSaleEnabled, autoConfirmDays, returnWindowDays

## Patterns Used
- All routes call `requireAdmin()` first and return 401 if unauthorized
- Consistent error handling with try/catch and proper HTTP status codes
- Uses `db` from `@/lib/db` for all database operations
- Follows existing codebase patterns from users/withdrawals routes
- Lint: passes with zero errors
