# Task 2+3a: Fix Inconsistent Headers & Delete Dead Code

## Part A: Header Fixes (4 screens)

All 4 screens now use the shared `PageHeader` component from `src/components/ecommerce/shared/layout.tsx`:

| Screen | Before | After |
|--------|--------|-------|
| search-screen.tsx | Custom search bar with ArrowLeft + Input | PageHeader "Cari" + search input below |
| stream-search-screen.tsx | Custom search bar with ArrowLeft + Input | PageHeader "Cari" + search input below |
| stream-user-profile-screen.tsx | Custom glass header with ArrowLeft + centered username | PageHeader with username |
| chat-screen.tsx (ChatRoomView) | Custom header with ArrowLeft + avatar + name | PageHeader with store name + rightAction |

Also cleaned unused `PageHeader` imports from:
- seller-dashboard.tsx
- admin/dashboard.tsx

## Part B: Dead Code Deletion

| File | Status | Reason |
|------|--------|--------|
| src/lib/api.ts | ✅ Deleted | Zero imports, insecure x-user-id header |
| src/lib/mock-data.ts | ✅ Deleted | Zero imports, duplicated utilities |
| src/store/auth-store.ts | ✅ Deleted | Zero imports, XSS-vulnerable localStorage |
| src/components/ecommerce/shared.tsx.bak | ✅ Deleted | Backup file |
| src/lib/api-types.ts | ⚠️ Retained | 1 active import in store-helpers.ts (SellerWalletData) |

## Lint: 0 new errors
