# Task 2 - Fix broken navigation and wiring in home, search, and category screens

## Agent: full-stack-developer

## Summary
Fixed all broken button handlers, banner clicks, and navigation wiring across 3 e-commerce screens.

## Changes Made

### home-screen.tsx
- Added `setSearchQuery` and `showToast` to store destructuring
- Created `handleQuickAction` callback that wires ALL 10 quick action buttons:
  - flash-sale → setSearchQuery("Flash Sale") + navigate("search")
  - voucher → navigate("voucher")
  - topup → navigate("deposit")
  - free-ship → setSearchQuery("Gratis Ongkir") + navigate("search")
  - coin → navigate("wallet")
  - live → showToast("Fitur Live Streaming segera hadir!", "info")
  - new → setSearchQuery("Baru") + navigate("search")
  - local → navigate("category")
  - promo → navigate("voucher")
  - more → showToast("Menu lainnya segera hadir!", "info")
- Created `handleBannerClick` callback making all 4 banners clickable:
  - Banner 0/1 (Mega Sale, Diskon) → Flash Sale search
  - Banner 2 (Gratis Ongkir) → Voucher screen
  - Banner 3 (Cashback) → Wallet screen
- Updated Flash Sale "Lihat Semua" to set searchQuery before navigating
- Added onAction + actionLabel to "Rekomendasi Untukmu" SectionHeader

### search-screen.tsx
- Added `selectedCategoryId` to store destructuring
- Added `useRef`-based initialization from store's `searchQuery` (avoids lint error)
- Modified `searchResults` useMemo to:
  - Pre-filter by `selectedCategoryId` when set (from category screen)
  - Show category-filtered products even without text query
  - Support "Flash Sale" / "flashsale" queries to show isFlashSale products
- Clear store's searchQuery after consuming it

### category-screen.tsx
- Added `setSearchQuery: setStoreSearchQuery` to store destructuring (renamed to avoid conflict with local state)
- Updated `handleSubCategoryTap` to call both `setSelectedCategory(subCat.id)` AND `setStoreSearchQuery(subCat.name)` before navigating to search

## Lint Status
- search-screen.tsx lint error resolved (was `react-hooks/set-state-in-effect`)
- Pre-existing order-screen.tsx lint error remains (not in scope)
