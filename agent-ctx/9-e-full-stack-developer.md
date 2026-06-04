# Task 9-e: Update Seller and Admin screens to API-based backend

## Summary
Updated the remaining Seller and Admin screens that were still using mock/Zustand data to use API-based React Query hooks instead.

## Changes Made

### 1. Fixed `useOrders` hook (`/src/hooks/api/use-orders.ts`)
- Added `_all?: boolean` option to `OrderFilters` interface
- Updated `enabled` condition to also check `filters?._all === true`
- Query function strips `_all` from API params before sending (client-only flag)

### 2. Fixed admin-orders-screen (`/src/components/ecommerce/admin-orders-screen.tsx`)
- Changed `useOrders({ sellerId: "all" })` → `useOrders({ _all: true })`
- Old pattern sent "all" as sellerId filter which matched no DB records

### 3. Updated SellerChat (`/src/components/ecommerce/seller-screens.tsx`)
- Added `useChatRooms` to imports
- Replaced `mockChatBuyers` with `useChatRooms(userId)` from API
- Chat cards display `room.otherUser.name`, `room.lastMessage`, `room.lastMessageTime`, `room.unreadCount`
- Added loading state (ListSkeleton) and empty state
- Chat cards are now clickable (navigate to chat-room)
- Removed `mockChatBuyers` constant

### 4. Verified already-migrated screens
All other seller/admin screens were already using API hooks from previous agents (9-b, 9-a, 9-d).

### Screens keeping mock data (no API endpoints exist)
- SellerCampaign: `mockCampaigns`
- AdminBanner: `mockBanners`
- AdminComplaints: `mockComplaints`

## Lint: Passes cleanly
