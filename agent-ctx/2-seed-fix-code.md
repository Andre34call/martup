# Task 2-seed-fix: Fix Prisma seed file to use honest/real default values

## Summary
Modified `prisma/seed.ts` to replace all inflated fake stats with honest zero values, and added a post-seed recalculation step that computes stats from actual seeded data.

## Changes Made
1. **Seller stats reset to 0**: rating, totalSales, totalProducts for all 3 sellers (s1, s2, s3)
2. **Product stats reset to 0**: sold, rating, reviewCount for all 12 products (p1–p12)
3. **Wallet balances fixed**: All 3 wallets (w1, w2, w3) now start with balance=500000, holdBalance=0
4. **Post-seed recalculation step added**: Computes real stats from actual OrderItems, Reviews, Products, and Orders

## Verification
- Lint passes ✅
- No changes to product names, descriptions, images, prices, stock, variants, seed order, or table cleanup logic
