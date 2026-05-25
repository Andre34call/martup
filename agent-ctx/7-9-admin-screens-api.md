# Task 7-9: Admin Screens API Integration

## Agent
Admin Screens API Integration Agent

## Summary
Updated 4 admin screen components in `src/components/ecommerce/admin-screens.tsx` to fetch data from real API endpoints instead of using client-side Zustand state.

## Changes Made

### AdminWithdraw
- Replaced `withdrawRequests` from Zustand store with local state fetched from `GET /api/admin/withdrawals`
- Replaced `updateWithdrawStatus` with `PATCH /api/admin/withdrawals` for approve/reject/process
- Adapted data format: flat `bankName`, `bankAccount` (string), `bankHolder` instead of nested `bankAccount` object
- Changed status from 'completed' to 'processed' to match API
- Replaced `rejectionReason` with `adminNote`, `requestDate` with `createdAt`
- Removed `netAmount`/`adminFee` display (not in API response)

### AdminBanner
- Replaced `adminBanners` from Zustand store with local state fetched from `GET /api/admin/banners`
- Added CRUD operations via API: POST (create), PATCH (toggle active), DELETE (remove)
- Added delete button per banner card
- Form inputs now controlled with state variables
- All mutations refresh data from API

### AdminAnalytics
- Replaced `computeTopSellers`/`computeCategoryPerformance` with data from `GET /api/admin/stats`
- Added `AdminStats` type and fetchStats() on mount
- Revenue chart uses `stats.revenueChart` from API
- Top Sellers table changed from "Rating" to "Pesanan" column
- Category Performance uses `stats.categoryPerformance` from API

### AdminComplaints
- Replaced `adminComplaints` from Zustand store with local state fetched from `GET /api/admin/complaints`
- Added `handleUpdateComplaint()` calling `PATCH /api/admin/complaints`
- Enhanced UI: shows orderNumber, orderTotal, resolution, refundAmount
- Added 'rejected' status display
- All mutations refresh data from API

### Cleanup
- Removed unused `computeTopSellers` and `computeCategoryPerformance` helper functions
- Removed unused type imports: `WithdrawStatus`, `OrderStatus`, `Order`, `StatusBadge`
- Fixed AdminDashboard `stats` object to include properties added by previous agent

## Files Modified
- `src/components/ecommerce/admin-screens.tsx` - Main changes to 4 components
- `worklog.md` - Added work record
