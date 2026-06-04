# Task 8 - Seller Screens Stats Update

## Task
Update seller screens to use real stats from Zustand store instead of computing stats client-side with placeholder values.

## Changes Made

### File: `/home/z/my-project/src/components/ecommerce/seller-screens.tsx`

1. **Import changes**: Added `ShoppingBag` to lucide-react imports

2. **SellerDashboard component**:
   - Added `sellerStats` and `fetchSellerStats` to useAppStore destructuring
   - Added `useEffect(() => { fetchSellerStats() }, [fetchSellerStats])` to fetch stats on mount
   - Updated `stats` object to use `sellerStats` data when available (totalRevenue, totalOrders, totalProducts, pendingOrders, monthlyRevenue, topProducts, recentOrders), falling back to local computation
   - Changed `Eye` icon to `ShoppingBag` for "Total Terjual" stat card (fixes confusion with "Pengunjung/Visitors")
   - Updated recent orders rendering to use `stats.recentOrders` from API when `sellerStats` is available, with optional chaining for `address` and `items` fields

3. **SellerAnalytics component**:
   - Added `sellerStats` and `fetchSellerStats` to useAppStore destructuring
   - Added `useEffect(() => { fetchSellerStats() }, [fetchSellerStats])` to fetch stats on mount
   - Updated `stats` object to use `sellerStats` data when available, falling back to local computation
   - Revenue chart now uses real `monthlyRevenue` data from API when available
   - Top products table uses real `topProducts` data from API when available

## Lint Result
Lint passes cleanly with no errors.
