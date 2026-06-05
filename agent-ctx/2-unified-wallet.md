# Task 2: Unified Wallet System

## Summary
Unified buyer and seller wallets into a SINGLE wallet per user. Each user now has exactly one wallet that handles:
- Top up (deposit) money
- Spending on purchases
- Receiving earnings from sales (via pendingBalance)
- Withdrawals

## Key Schema Change
- **Removed** `sellerId` field from `Wallet` model
- **Removed** `wallet Wallet?` relation from `Seller` model
- **Removed** `seller Seller?` relation from `Wallet` model
- Each user has exactly ONE wallet (linked by `userId @unique`)

## Files Modified (28 files)

### Schema
- `prisma/schema.prisma` — Removed sellerId, wallet relation from Seller

### Backend API Routes
- `src/lib/seller-payout.ts` — userId lookup instead of sellerId
- `src/app/api/wallet/debit/route.ts` — userId lookup, removed wallet from seller select
- `src/app/api/wallet/debit-batch/route.ts` — userId lookup, removed wallet from seller select
- `src/app/api/wallet/withdraw/route.ts` — single userId lookup
- `src/app/api/seller/withdraw/route.ts` — userId lookup
- `src/app/api/seller/register/route.ts` — removed wallet creation/linking
- `src/app/api/admin/withdrawals/route.ts` — find seller.userId then find wallet
- `src/app/api/withdrawals/[id]/route.ts` — find seller.userId then find wallet
- `src/app/api/orders/[id]/cancel/route.ts` — userId lookup, added seller to include
- `src/app/api/admin/orders/[id]/verify-payment/route.ts` — userId lookup
- `src/app/api/payment/notification/route.ts` — userId lookup, removed wallet from seller select
- `src/app/api/cron/auto-confirm-service/route.ts` — userId lookup, removed wallet from seller select
- `src/app/api/cron/auto-complete/route.ts` — userId lookup, removed wallet from seller select
- `src/app/api/seed/route.ts` — removed seller wallet upsert
- `src/app/api/user/delete/route.ts` — removed seller wallet deletion
- `src/app/api/seller/profile/route.ts` — separate wallet query by userId
- `src/app/api/user-data/route.ts` — removed wallet from seller include

### Shared Lib
- `src/lib/order-status.ts` — userId lookup, removed wallet from seller select
- `src/lib/order-utils.ts` — userId lookup, removed wallet from seller select

### Frontend / Store
- `src/lib/store/types.ts` — added walletPendingBalance
- `src/lib/store/wallet.ts` — added walletPendingBalance state + fetch
- `src/lib/store/data-fetch.ts` — derive sellerBalance from unified wallet
- `src/lib/store/auth.ts` — derive seller balance from userData.wallet
- `src/lib/store-helpers.ts` — added walletPendingBalance to reset state
- `src/components/ecommerce/wallet-screen.tsx` — show pending balance

## Pattern Used
All wallet lookups changed from:
```typescript
// OLD: Find wallet by seller ID
const wallet = await tx.wallet.findUnique({ where: { sellerId: sellerId } })
```
to:
```typescript
// NEW: Find wallet by user ID (unified wallet)
const wallet = await tx.wallet.findUnique({ where: { userId: sellerUserId } })
```

For admin/withdrawal operations that only have the sellerId:
```typescript
// Step 1: Find seller's userId
const seller = await tx.seller.findUnique({ where: { id: sellerId }, select: { userId: true } })
// Step 2: Find the unified wallet
const wallet = seller ? await tx.wallet.findUnique({ where: { userId: seller.userId } }) : null
```
