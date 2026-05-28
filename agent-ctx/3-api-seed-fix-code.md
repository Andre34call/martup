# Task 3-api-seed-fix — Agent: code

## Summary
Fixed API seed route (`src/app/api/seed/route.ts`) to use honest/real default values instead of inflated fake stats.

## Changes Made
1. **Seller data**: Reset all 5 sellers' rating/totalSales/totalProducts to 0
2. **Product data**: Reset all 14 products' sold/rating/reviewCount to 0
3. **Wallet balance**: Changed from `sd.totalSales * 5000` to fixed `500000`; holdBalance from `1500000` to `0`
4. **Post-seed recalculation**: Added 5 recalculation blocks that derive real stats from actual database data

## Verification
- Lint passes ✅
- Dev server compiles ✅
