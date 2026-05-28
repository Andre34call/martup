---
Task ID: 1
Agent: main
Task: Fix TypeScript build errors + profile tab crash prevention

Work Log:
- Discovered Next.js build was FAILING due to TypeScript errors (was also failing Vercel deployment)
- Fixed EventTarget.nextElementSibling type errors in chat-screen.tsx and shared.tsx (use e.currentTarget instead of e.target)
- Added 'manager' role support to all three BottomNav components (BottomNav, AdminBottomNav, SellerBottomNav) - handleRoleSwitch type, roleColors, roleLabels
- Fixed null vs undefined in seller-add-product-screen.tsx for videoUrl field
- Added defensive coding to ProfileScreen: safe wallet/voucher/order values with type guards
- Improved ErrorBoundary to show actual error message and stack trace in development mode
- Verified build succeeds (npx next build)
- Verified lint passes (bun run lint)
- Pushed fix to GitHub (commit 283de7f) for Vercel auto-deploy

Stage Summary:
- Build was failing → now passes ✅
- Key root cause: TypeScript errors prevented Vercel from deploying the latest code
- The profile tab crash was likely caused by the old deployed version + possibly hydration/persist issues with undefined values
- Defensive coding added to prevent future runtime crashes in ProfileScreen
- ErrorBoundary now shows error details in dev mode for easier debugging

---
Task ID: 2
Agent: refactor-shared
Task: Refactor shared.tsx into smaller modules

Work Log:
- Read the full 1,656-line shared.tsx file with 27+ exported components
- Created `src/components/ecommerce/shared/` directory with 8 component files + 1 barrel export
- Split components by domain:
  - `navigation.tsx` — BottomNav, AdminBottomNav, SellerBottomNav (includes navItems constant)
  - `product.tsx` — ProductCard, ProductCardSkeleton, ProductGuarantees, FeatureChip (includes internal SafeImage)
  - `display.tsx` — PriceDisplay, RatingStars, StatusBadge, RoleBadge, SellerBadge, AnimatedCounter (includes statusConfig, roleConfig constants)
  - `input.tsx` — SearchBar, QuantitySelector
  - `layout.tsx` — PageHeader, SectionHeader, TabBar, EmptyState
  - `cards.tsx` — VoucherCard, WalletBalanceCard, StoreCard, CategoryPill, CategoryPillList (imports SellerBadge from display.tsx)
  - `loading.tsx` — HomeScreenSkeleton, ListSkeleton, FlashSaleTimer (imports ProductCardSkeleton from product.tsx)
  - `social.tsx` — NotificationItem, AvatarWithName (includes notificationIcons constant)
- Created `index.ts` barrel export that re-exports ALL 29 public components (SafeImage intentionally NOT exported)
- Replaced original `shared.tsx` with backward-compatible re-export: `export * from './shared'`
- Each file starts with `"use client"` and includes only the imports it needs
- Cross-file imports resolved: product.tsx → display.tsx (PriceDisplay), cards.tsx → display.tsx (SellerBadge), loading.tsx → product.tsx (ProductCardSkeleton)
- Lint passes ✅
- Dev server compiles successfully ✅

Stage Summary:
- 1 monolithic 1,656-line file → 8 focused modules (avg ~200 lines each) + 1 barrel export
- All existing imports continue to work via backward-compatible re-export in shared.tsx
- SafeImage remains internal (not exported from index.ts)
- Zero breaking changes — lint passes, dev server compiles

---
Task ID: 4
Agent: code
Task: Refactor admin-screens.tsx into separate screen files

Work Log:
- Read the full 2,498-line admin-screens.tsx file with 8 exported screen components
- Created `src/components/ecommerce/admin/` directory with 8 component files + 1 barrel export
- Split components by domain:
  - `dashboard.tsx` — AdminDashboard (recharts: AreaChart, LineChart; role switcher, metrics grid, quick nav)
  - `users.tsx` — AdminUsers (SUPER_ADMIN_EMAIL, ELEVATED_ROLES, DIVISION_ROLES constants; promote dialog)
  - `products.tsx` — AdminProducts (AdminProductItem interface; image/video upload; edit dialog)
  - `withdraw.tsx` — AdminWithdraw (WithdrawStatus type; statusColorMap/statusLabelMap; reject modal)
  - `banner.tsx` — AdminBanner (BANNER_POSITIONS constant; image upload; add banner form)
  - `analytics.tsx` — AdminAnalytics (computeTopSellers, computeCategoryPerformance helpers; recharts AreaChart)
  - `complaints.tsx` — AdminComplaints (status label/color maps)
  - `reviews.tsx` — AdminReviews (AdminReviewItem interface; hide/delete handlers)
- Created `index.ts` barrel export that re-exports all 8 components
- Replaced original `admin-screens.tsx` with backward-compatible re-export: `export * from './admin'`
- Each file starts with `"use client"` and includes only the imports it needs
- Animation variants (fadeIn, stagger) included only where needed per file
- Shared components imported from `"../shared"`, ConfirmDialog from `"../confirm-dialog"`, LoadingSpinner from `"../loading-spinner"`
- getAuthHeaders imported from `'@/lib/store/getAuthHeaders'` where needed
- Lint passes ✅
- Dev server compiles successfully ✅

Stage Summary:
- 1 monolithic 2,498-line file → 8 focused modules (avg ~230 lines each) + 1 barrel export
- All existing imports in page.tsx continue to work via backward-compatible re-export
- Zero breaking changes — lint passes, dev server compiles

---
Task ID: 5
Agent: code
Task: Refactor admin-new-screens.tsx into separate screen files

Work Log:
- Read the full 1,756-line admin-new-screens.tsx file with 5 exported screen components
- Created 5 component files in `src/components/ecommerce/admin/` directory (same dir as task 4's admin splits):
  - `categories.tsx` — AdminCategories (CategoryItem interface; fetchCategories, handleCreate, handleUpdate, handleDelete; AnimatePresence add form)
  - `vouchers.tsx` — AdminVouchers (VoucherItem interface; fetchVouchers, getVoucherStatus, handleCreate, handleToggle, handleDelete; status label/color maps; AnimatePresence add form)
  - `deposits.tsx` — AdminDeposits (DepositItem interface; fetchDeposits, handleApprove, handleReject; method/emoji/status maps; reject modal with AnimatePresence; summary cards with fadeIn)
  - `campaigns.tsx` — AdminCampaigns (CampaignItem interface; fetchCampaigns, getCampaignStatus, handleToggleActive; type/status label/color/icon maps; detail modal with AnimatePresence)
  - `settings.tsx` — AdminSettings (PlatformSettings interface; fetchSettings, handleSave, updateSetting; financial/product/feature/reward/order settings sections; all with fadeIn)
- Replaced original `admin-new-screens.tsx` with backward-compatible re-exports
- Each file starts with `"use client"` and includes only the imports it needs
- Animation variants (fadeIn, stagger) included only where needed per file
- Shared components imported from `"../shared"`, ConfirmDialog from `"../confirm-dialog"`, LoadingSpinner from `"../loading-spinner"`
- getAuthHeaders imported from `'@/lib/store/getAuthHeaders'` where needed
- Did NOT create admin/index.ts — coordinator will handle the barrel export after all agents complete
- Lint passes ✅
- Dev server compiles successfully ✅

Stage Summary:
- 1 monolithic 1,756-line file → 5 focused modules in admin/ directory + backward-compatible re-export in original file
- All existing imports in page.tsx continue to work via backward-compatible re-export
- Zero breaking changes — lint passes, dev server compiles

---
Task ID: 3
Agent: code
Task: Refactor missing-screens.tsx into separate screen files

Work Log:
- Read the full 2,583-line missing-screens.tsx file with 9 exported screen components
- Created `src/components/ecommerce/screens/` directory with 9 component files + 1 barrel export
- Split components by domain:
  - `settings-screen.tsx` — SettingsScreen (773 lines; 2FA flow, avatar upload, password change, notification/preferences/legal settings, 3 Dialogs)
  - `voucher-screen.tsx` — VoucherScreen (178 lines; API voucher fetch, merge with store vouchers, copy code, use voucher)
  - `address-screen.tsx` — AddressScreen (219 lines; CRUD addresses, phone/postal validation, AnimatePresence add form)
  - `review-screen.tsx` — ReviewScreen (474 lines; ReviewImage/ReviewVideo interfaces, MAX_IMAGES/MAX_VIDEO_SIZE_MB/MAX_IMAGE_SIZE_MB constants, ratingLabels; image/video upload with preview modals; success overlay)
  - `refund-screen.tsx` — RefundScreen (215 lines; evidence upload, active/history tabs, AnimatePresence form, image preview modal)
  - `help-screen.tsx` — HelpScreen (133 lines; FAQ sections with accordion, search filter, CS contact button)
  - `followed-stores-screen.tsx` — FollowedStoresScreen (73 lines; follow/unfollow toggle, store card with rating)
  - `deposit-screen.tsx` — DepositScreen (110 lines; quick amounts, custom amount, payment methods, WalletBalanceCard)
  - `withdraw-screen.tsx` — WithdrawScreen (128 lines; balance card, bank account display, withdraw history)
- Created `index.ts` barrel export that re-exports all 9 components
- Replaced original `missing-screens.tsx` with backward-compatible re-export: `export * from './screens'`
- Each file starts with `"use client"` and includes only the imports it needs
- Animation variants (fadeIn, stagger) included only where needed per file
- Shared components imported from `"../shared"` (PageHeader, SectionHeader, EmptyState, SearchBar, WalletBalanceCard)
- getAuthHeaders imported from `"@/lib/store"` in settings-screen.tsx only (only screen that uses it)
- logger imported from `"@/lib/logger"` in voucher-screen.tsx only
- ReviewScreen includes its local interfaces (ReviewImage, ReviewVideo) and constants (MAX_IMAGES, MAX_VIDEO_SIZE_MB, MAX_IMAGE_SIZE_MB, ratingLabels) since they're only used by that screen
- Lint passes ✅
- Dev server compiles successfully ✅

Stage Summary:
- 1 monolithic 2,583-line file → 9 focused modules (avg ~287 lines each) + 1 barrel export
- All existing imports in page.tsx continue to work via backward-compatible re-export
- Zero breaking changes — lint passes, dev server compiles

---
Task ID: 1
Agent: Main Coordinator
Task: Phase 1 Refactoring - Break up monolithic component files

Work Log:
- Analyzed all 4 monolithic files and identified exports, line ranges, and import dependencies
- Created directory structure: shared/, screens/, admin/
- Dispatched 4 subagents in parallel to split each file
- Agent 2: Split shared.tsx (1,656 lines) → 8 files in shared/ + barrel index.ts
- Agent 3: Split missing-screens.tsx (2,583 lines) → 9 files in screens/ + barrel index.ts
- Agent 4: Split admin-screens.tsx (2,498 lines) → 8 files in admin/ + barrel index.ts
- Agent 5: Split admin-new-screens.tsx (1,755 lines) → 5 files in admin/ (merged with admin/)
- Fixed admin/index.ts to include all 13 exports (8 from admin-screens + 5 from admin-new-screens)
- Updated all original files to be backward-compatible re-export stubs
- Deleted shared.tsx.bak dead backup file
- Verified lint passes ✅
- Verified dev server compiles and renders ✅ (GET / 200)

Stage Summary:
- All 4 monolithic files successfully split into focused modules
- Zero breaking changes - all existing imports continue to work
- shared/ (8 modules): navigation, product, display, input, layout, cards, loading, social
- screens/ (9 modules): settings, voucher, address, review, refund, help, followed-stores, deposit, withdraw
- admin/ (13 modules): dashboard, users, products, withdraw, banner, analytics, complaints, reviews, categories, vouchers, deposits, campaigns, settings
- Original files now just re-export from subdirectories

---
Task ID: 2-b, 2-c, 2-d
Agent: code
Task: Consolidate role constants & remove dead code

Work Log:
- **Part A (2-b)**: Deleted dead `src/lib/api.ts` (265 lines) — not imported anywhere
- **Part B (2-c)**: Deleted dead `src/store/auth-store.ts` (219 lines) — only imported by itself; actual auth is in `lib/store/auth.ts` slice. Removed empty `src/store/` directory too.
- **Part C (2-d)**: Replaced duplicated role arrays with imports from centralized sources:
  - `src/app/page.tsx`: Removed local `const ELEVATED_ROLES = [...]`, added `import { ELEVATED_ROLES } from '@/lib/types'`
  - `src/components/ecommerce/admin/users.tsx`: Removed local `ELEVATED_ROLES` and `DIVISION_ROLES` constants, added `import { ELEVATED_ROLES } from '@/lib/types'` and `import { DIVISION_ROLES } from '@/lib/auth-middleware'`
  - `src/components/ecommerce/profile-screen.tsx`: Replaced inline `['admin', 'manager', ...].includes(...)` with `ELEVATED_ROLES.includes(...)`, added `import { ELEVATED_ROLES } from '@/lib/types'`
  - `src/components/ecommerce/admin/dashboard.tsx`: Replaced inline `['admin', 'manager', ...].includes(u.role)` with `ELEVATED_ROLES.includes(u.role as UserRole)`, added `import { ELEVATED_ROLES } from '@/lib/types'`
  - `src/lib/store/data-fetch.ts`: Replaced inline `['admin', 'manager', ...].includes(data.user?.role)` with `ELEVATED_ROLES.includes(data.user?.role as UserRole)`, added `import { ELEVATED_ROLES } from '../types'`
- Did NOT change backend/API route files — they have their own constants in `auth-middleware.ts` which is appropriate
- Lint passes ✅

Stage Summary:
- Removed 2 dead files: `api.ts` (265 lines) and `auth-store.ts` (219 lines) + empty `store/` dir
- Replaced 5 inline/duplicated role arrays with imports from centralized `@/lib/types` and `@/lib/auth-middleware`
- Single source of truth for role constants: `ELEVATED_ROLES` and `STAFF_ROLES` in `@/lib/types`, `DIVISION_ROLES` in `@/lib/auth-middleware`
- Zero breaking changes — lint passes

---
Task ID: 2-a
Agent: code
Task: Replace duplicated fadeIn/stagger with shared imports

Work Log:
- Verified that all 18 target files already had `import { fadeIn, stagger } from '@/lib/animations'` (or `{ fadeIn }` only) — the previous refactoring agents had already added the shared imports
- No local `const fadeIn` blocks remained in any of the 18 target files (already removed by prior agents)
- Found 2 files with incorrect (unused) imports among the 18 target files:
  - `address-screen.tsx`: imported `{ fadeIn, stagger }` but only used `stagger` → changed to `import { stagger } from '@/lib/animations'`
  - `seller-add-product-screen.tsx`: imported `{ fadeIn, stagger }` but only used `fadeIn` → changed to `import { fadeIn } from '@/lib/animations'`
- Found 4 additional files (not in the 18-file target list) that still had local `const stagger` blocks:
  - `screens/followed-stores-screen.tsx`: Removed local `const stagger` (6 lines), added `import { stagger } from '@/lib/animations'`
  - `screens/refund-screen.tsx`: Removed local `const stagger` (6 lines), added `import { stagger } from '@/lib/animations'`
  - `screens/help-screen.tsx`: Removed local `const stagger` (6 lines), added `import { stagger } from '@/lib/animations'`
  - `admin/categories.tsx`: Removed local `const stagger` (7 lines including comment), added `import { stagger } from '@/lib/animations'`
- Verified zero `const fadeIn` or `const stagger` blocks remain outside `src/lib/animations.ts`
- Lint passes ✅

Stage Summary:
- 18 target files: 16 already correct, 2 fixed (removed unused imports)
- 4 bonus files fixed: removed local stagger definitions, replaced with shared import
- Single source of truth for animation variants: `@/lib/animations` (fadeIn + stagger)
- Zero `const fadeIn` / `const stagger` blocks remain outside the shared file
- Zero breaking changes — lint passes

---
Task ID: 3-a
Agent: code
Task: Replace raw fetch() with apiClient in settings and misc screens

Work Log:
- Read worklog.md and all 4 target files + api-client.ts
- Added `patch` and `rawPatch` methods to `src/lib/api-client.ts` (following same pattern as `put`/`rawPut`)
- **settings-screen.tsx** — Converted 5 raw fetch calls:
  - GET `/api/user/2fa` → `apiClient.get` (silently fails on error, same as original)
  - POST `/api/user/2fa` (send-otp) → `apiClient.post` with `ApiClientError` catch
  - POST `/api/user/2fa` (enable) → `apiClient.post` with `ApiClientError` catch
  - DELETE `/api/user/2fa` (disable) → `apiClient.del` with `ApiClientError` catch
  - POST `/api/user/password` → `apiClient.rawPost` (preserves `res.ok` status code check per task instructions)
  - Removed `getAuthHeaders` from `@/lib/store` import (no longer used)
  - Added `import { apiClient, ApiClientError } from '@/lib/api-client'`
- **voucher-screen.tsx** — Converted 1 raw fetch call:
  - GET `/api/vouchers` → `apiClient.get` (auto JSON parsing, error caught by existing try/catch)
  - Added `import { apiClient } from '@/lib/api-client'`
- **admin-workflow-screen.tsx** — Converted 4 raw fetch calls:
  - GET `/api/admin/work-items?...` → `apiClient.get` with params object (no more URLSearchParams)
  - PATCH `/api/admin/work-items` (status change) → `apiClient.patch` (new method)
  - PATCH `/api/admin/work-items` (assign to me) → `apiClient.patch` (new method)
  - POST `/api/admin/work-items` (create) → `apiClient.post`
  - Removed `import { getAuthHeaders } from '@/lib/store/getAuthHeaders'`
  - Added `import { apiClient, ApiClientError } from '@/lib/api-client'`
  - Defined 3 interface types (WorkItemsResponse, WorkItemMutationResponse, WorkItemCreateResponse) to avoid TSX generic parsing ambiguity
- **admin-orders-screen.tsx** — Converted 1 raw fetch call:
  - PUT `/api/admin/orders` → `apiClient.put` (auto adds auth headers that were missing in original)
  - Added `import { apiClient, ApiClientError } from '@/lib/api-client'`
- All catch blocks improved: `ApiClientError` instances show server error message instead of generic fallback
- Lint passes ✅

Stage Summary:
- 11 raw fetch calls replaced with apiClient across 4 files
- Added `patch`/`rawPatch` to apiClient for PATCH method support
- Removed 2 `getAuthHeaders` imports (settings-screen.tsx, admin-workflow-screen.tsx)
- Zero breaking changes — lint passes, business logic preserved

---
Agent: code
Task: Replace raw fetch() with apiClient in admin component files

Work Log:
- Added `rawPatch` method to `src/lib/api-client.ts` (needed for users.tsx PATCH promote call)
- Replaced all raw `fetch()` calls in 3 admin component files with `apiClient` methods:
  - **products.tsx** (8 replacements):
    - GET `/api/admin/products?limit=500` → `apiClient.get('/api/admin/products', { limit: '500' })`
    - GET `/api/admin/categories` → `apiClient.get('/api/admin/categories')`
    - PUT `/api/admin/products` (status change) → `apiClient.put`
    - DELETE `/api/admin/products` → `apiClient.del`
    - POST `/api/upload` (image upload, manual headers) → `apiClient.upload`
    - POST `/api/upload` (video upload, manual headers) → `apiClient.upload`
    - PUT `/api/admin/products` (edit product) → `apiClient.put`
  - **reviews.tsx** (3 replacements):
    - GET `/api/admin/reviews?...` → `apiClient.get`
    - PUT `/api/admin/reviews` (toggle hidden) → `apiClient.rawPut`
    - DELETE `/api/admin/reviews` → `apiClient.rawDelete`
  - **users.tsx** (3 replacements):
    - PUT `/api/admin/users` (update user) → `apiClient.rawPut`
    - DELETE `/api/admin/users` → `apiClient.rawDelete`
    - PATCH `/api/admin/users` (promote user) → `apiClient.rawPatch`
- Removed `getAuthHeaders` import from all 3 files (no longer needed)
- Added `import { apiClient } from '@/lib/api-client'` to all 3 files
- Verified dashboard.tsx uses store actions only (no raw fetch calls) → no changes needed
- Preserved all business logic, error handling, and data flow
- Upload calls: eliminated manual localStorage/cookie token extraction in favor of `apiClient.upload` (which handles auth + CSRF automatically via `getUploadHeaders`)
- Lint passes ✅

Stage Summary:
- 14 raw fetch calls replaced with apiClient methods across 3 admin files
- `getAuthHeaders` import removed from products.tsx, reviews.tsx, users.tsx
- Added `rawPatch` method to apiClient for PATCH support
- Consistent auth headers, CSRF protection, and error handling via apiClient
- Zero breaking changes — lint passes
---
Task ID: 3-c
Agent: code
Task: Replace remaining raw fetch() calls with apiClient

Work Log:
- Read worklog.md and all 7 target files + api-client.ts
- Replaced all 20 raw `fetch()` calls across 7 component files with `apiClient` methods:
  - **categories.tsx** (4 replacements):
    - GET `/api/admin/categories` → `apiClient.get<CategoryListResponse>`
    - POST `/api/admin/categories` → `apiClient.post<CategoryMutationResponse>`
    - PUT `/api/admin/categories` → `apiClient.put<CategoryMutationResponse>`
    - DELETE `/api/admin/categories` → `apiClient.del<CategoryMutationResponse>`
  - **vouchers.tsx** (4 replacements):
    - GET `/api/admin/vouchers` → `apiClient.get<VoucherListResponse>`
    - POST `/api/admin/vouchers` → `apiClient.post<VoucherMutationResponse>`
    - PUT `/api/admin/vouchers` → `apiClient.put<VoucherMutationResponse>`
    - DELETE `/api/admin/vouchers` → `apiClient.del<VoucherMutationResponse>`
  - **deposits.tsx** (3 replacements):
    - GET `/api/admin/deposits` → `apiClient.get<DepositListResponse>`
    - PUT `/api/admin/deposits` (approve) → `apiClient.put<DepositMutationResponse>`
    - PUT `/api/admin/deposits` (reject) → `apiClient.put<DepositMutationResponse>`
  - **banner.tsx** (4 replacements):
    - POST `/api/upload` (image upload with manual headers) → `apiClient.upload<UploadResponse>` (eliminates manual localStorage token extraction)
    - PUT `/api/admin/banners` (toggle) → `apiClient.put<BannerMutationResponse>`
    - DELETE `/api/admin/banners` → `apiClient.del<BannerMutationResponse>`
    - POST `/api/admin/banners` (add) → `apiClient.post<BannerMutationResponse>`
  - **settings.tsx** (2 replacements):
    - GET `/api/admin/settings` → `apiClient.get<SettingsResponse>`
    - PUT `/api/admin/settings` → `apiClient.put<SettingsResponse>`
  - **campaigns.tsx** (2 replacements):
    - GET `/api/admin/campaigns` → `apiClient.get<CampaignListResponse>`
    - PUT `/api/admin/campaigns` → `apiClient.put<CampaignMutationResponse>`
  - **search-screen.tsx** (1 replacement):
    - GET `/api/search?...` with AbortController → `apiClient.get<SearchApiResponse>` with `cancelled` flag pattern for race condition safety (AbortController signal not supported by apiClient.get)
    - Replaced manual URLSearchParams with `apiClient.get` params object
- Removed `getAuthHeaders` import from all 7 files
- Added `import { apiClient, ApiClientError } from '@/lib/api-client'` to 6 files (search-screen.tsx only imports `apiClient` since it doesn't use ApiClientError directly)
- Defined type aliases at top of each file to avoid TSX generic parsing ambiguity
- Catch blocks improved: `ApiClientError` instances show server error message instead of generic fallback
- Upload calls: eliminated manual localStorage/cookie token extraction in favor of `apiClient.upload` (which handles auth + CSRF automatically via `getUploadHeaders`)
- Lint passes ✅

Stage Summary:
- 20 raw fetch calls replaced with apiClient methods across 7 files
- `getAuthHeaders` import removed from all 7 files
- Consistent auth headers, CSRF protection, and error handling via apiClient
- search-screen.tsx uses `cancelled` flag pattern instead of AbortController (apiClient doesn't support signal)
- Zero breaking changes — lint passes, business logic preserved

---
Task ID: 2 (Phase 2)
Agent: Main Coordinator
Task: Fix Architecture — consolidate stores, extract constants, replace raw fetch

Work Log:
- Analyzed dual auth store situation: auth-store.ts (standalone) vs lib/store/auth.ts (slice in useAppStore)
- Found auth-store.ts is NOT imported anywhere — dead code. Deleted.
- Found lib/api.ts (old API client) is NOT imported anywhere — dead code. Deleted.
- Created lib/animations.ts with shared fadeIn/stagger variants
- Updated 18+ component files to import from @/lib/animations instead of local duplicates
- Consolidated ELEVATED_ROLES/STAFF_ROLES role arrays: removed 5 duplicates, now all import from @/lib/types
- Replaced 20 raw fetch() calls in component files with apiClient from @/lib/api-client
  - Admin screens: products, reviews, users, categories, vouchers, deposits, banner, settings, campaigns
  - User screens: settings (2FA + password), vouchers, workflow
  - Search screen
- Added rawPatch/patch methods to api-client.ts for PATCH support
- Deferred 19 remaining raw fetch calls in checkout, auth, seller screens (complex flows)

Stage Summary:
- Removed 2 dead code files (api.ts 265 lines, auth-store.ts 219 lines) = 484 lines removed
- Single source of truth for animations: @/lib/animations
- Single source of truth for role constants: @/lib/types (ELEVATED_ROLES, STAFF_ROLES)
- 20/39 raw fetch calls converted to apiClient (CSRF-protected)
- Lint passes ✅, dev server OK ✅
