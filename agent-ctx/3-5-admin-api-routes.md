# Task 3-5: Admin API Routes (Withdrawals, Banners, Complaints)

## Summary
Created 3 admin API route files with 8 total endpoints, all querying real Supabase PostgreSQL data via Prisma.

## Files Created

### 1. `src/app/api/admin/withdrawals/route.ts`
- **GET**: List withdrawals with seller info (storeName, user name, email). Supports `status` filter and pagination (`page`, `limit`). Seller info fetched via separate query since Withdrawal model has no Prisma relation to Seller.
- **PATCH**: Update withdrawal status with transition validation:
  - `pending` → `approved` or `rejected`
  - `approved` → `processed`
  - Terminal states (`processed`, `rejected`) cannot be changed
  - Auto-sets `processedAt` to `new Date()` when status becomes `processed`

### 2. `src/app/api/admin/banners/route.ts`
- **GET**: List all banners ordered by `sortOrder` ascending
- **POST**: Create banner (requires `title` and `image`; optional: `link`, `position`, `sortOrder`, `isActive`, `startDate`, `endDate`)
- **PATCH**: Update banner by `bannerId` with allowed fields; converts date strings to Date objects
- **DELETE**: Delete banner by `bannerId` query param

### 3. `src/app/api/admin/complaints/route.ts`
- **GET**: List complaints with order/user/seller info via nested Prisma includes (`complaint -> order -> user` and `order -> seller`). Supports `status` filter, `type` filter, and pagination.
- **PATCH**: Update complaint by `complaintId`. Validates `status` (open/processing/resolved/rejected) and `refundAmount` (non-negative number). Allowed fields: `status`, `resolution`, `refundAmount`.

## Design Decisions
- Withdrawal seller info: Since the Prisma schema's Withdrawal model has `sellerId` as a plain String (no `@relation`), seller info is fetched separately and mapped via a `Map` for O(1) lookup.
- Complaint user info: Obtained through the Order relation chain (`complaint -> order -> user` and `order -> seller`) using nested `include`.
- All routes follow existing project patterns from `/api/admin/users` and `/api/admin/divisions`.
- Lint passes cleanly.
