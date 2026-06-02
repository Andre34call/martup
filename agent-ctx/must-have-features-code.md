# Task: must-have-features — Agent: code

## Summary
Fixed 4 must-have missing features in the MartUp e-commerce app.

## Changes Made

### MF2 — Admin withdrawal approval flow
**File**: `/home/z/my-project/src/app/api/admin/withdrawals/route.ts`
- Restructured PUT handler: holdBalance deducted on `approved` (not `processed`)
- Added SELECT FOR UPDATE row-level locking for both approval and rejection
- Added holdBalance sufficiency check before approval
- Allowed `approved → rejected` transition (bank transfer failure edge case)
- `processed` now just sets processedAt and confirms (no wallet change)

### MF3 — Admin deposit approval verification
**File**: `/home/z/my-project/src/app/api/admin/deposits/route.ts`
- Added SELECT FOR UPDATE on Wallet row before balance increment
- Existing flow was already correct (transaction, WalletMutation, status update)

### MF4 — Missing Prisma indexes
**File**: `/home/z/my-project/prisma/schema.prisma`
- Added `@@index([sellerId])` on Withdrawal model
- Added `@@index([userId])` on ChatParticipant model
- Ran `npx prisma db push` successfully

### MF11 — Vercel Cron configuration
**File**: `/home/z/my-project/vercel.json`
- cancel-expired: `0 0 * * *` → `*/15 * * * *` (every 15 minutes)
- auto-complete: `0 0 * * *` → `0 */6 * * *` (every 6 hours)
- auto-complete-stuck: unchanged (daily at 9am)
- Cron security (CRON_SECRET check) already implemented in all cron routes

## Lint Status
✅ `bun run lint` passes
