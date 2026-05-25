---
Task ID: 1
Agent: Main Agent
Task: Refactor MartUp codebase for maintainability and prevent accidental feature deletion

Work Log:
- Analyzed the full codebase structure: 1960-line monolithic store.ts, 37 API routes, 20+ screen components
- Identified main maintenance risks: monolithic store, duplicated API patterns, no domain-based organization
- Created `/home/z/my-project/src/lib/store/` directory with 24 modular slice files
- Split the 1960-line store.ts into 19 domain-specific Zustand slices using the StateCreator pattern
- Created backward-compatible re-export in store.ts so all existing imports continue to work
- Created shared API utilities file (`api-utils.ts`) for common patterns across 37 API routes
- Fixed import paths (../../types → ../types) and circular import issues
- Verified TypeScript compilation passes with zero store-related errors
- Verified dev server starts and page loads successfully (GET / 200)

Stage Summary:
- **Store Refactoring**: Split 1 monolithic 1960-line file into 24 modular files organized by domain
  - `types.ts` — All 19 slice interfaces + AppStore combined type
  - `navigation.ts`, `ui.ts`, `selection.ts`, `search.ts`, `profile.ts`, `settings.ts`, `voucher.ts`, `address.ts`, `wallet.ts`, `followed-stores.ts` — Simple independent slices
  - `notification.ts`, `chat.ts`, `order.ts`, `product.ts`, `review.ts`, `seller.ts`, `admin.ts` — Slices with cross-slice dependencies
  - `auth.ts`, `data-fetch.ts` — Cross-cutting slices (logout/fetchUserData access multiple domains)
  - `cart.ts`, `wishlist.ts` — Separate stores (unchanged logic, moved to new directory)
  - `getAuthHeaders.ts` — Shared auth header utility
  - `index.ts` — Composed store using Zustand slice pattern
- **API Utilities**: Created `api-utils.ts` with response helpers, auth verification, error handling, query param parsing, and JSON field parsing
- **Backward Compatibility**: All existing `import { useAppStore, useCartStore, useWishlistStore, getAuthHeaders } from '@/lib/store'` continue to work unchanged
