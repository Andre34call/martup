# Task 2 — Cart & Wishlist Sync Fix

## Summary
Fixed the critical bug where the `useDataSync` hook was defined but never imported, causing cart and wishlist data to not sync from the server on page refresh for email/password users.

## Problem
- `useDataSync` in `src/lib/use-data-sync.ts` was defined but NEVER imported anywhere
- Cart/wishlist data did NOT sync from the server on page refresh
- For email/password users, after page refresh, their cart/wishlist only showed stale localStorage data
- Only `DataFetcher` in `providers.tsx` handled Google OAuth session sync, not page-refresh re-sync
- Two auth stores (`useAuthStore` and `useAppStore`) were not coordinated for data sync

## Root Cause Analysis
The app has two auth mechanisms:
1. **`useAuthStore`** (email/password) — persists to localStorage via `martup_*` keys, re-initializes on page refresh
2. **`useAppStore`** (Google OAuth) — `isAuthenticated` is NOT persisted, set by `DataFetcher`

On page refresh for email/password users:
- `useAuthStore` re-initializes from localStorage → `isAuthenticated: true`
- `useAppStore` stays `isAuthenticated: false` (not persisted)
- No code bridges the gap or triggers data sync from `useAuthStore`'s auth state
- Result: stale localStorage cart/wishlist data, no server sync

## Changes Made

### 1. `src/lib/use-data-sync.ts` — Complete rewrite
- Now watches BOTH auth stores (`useAuthStore` and `useAppStore`)
- Determines effective auth state: `appStoreUserId || authStoreUserId`
- Triggers data sync when authenticated and `isDataLoaded` is false
- Guards against double-sync with `syncingRef` and `lastSyncedUserIdRef`
- On sync failure, clears `lastSyncedUserIdRef` to allow retry
- Resets `isDataLoaded` when both stores report unauthenticated (full logout)
- `fetchUserData` also bridges auth to `useAppStore` (sets `isAuthenticated: true`, `currentUser`)

### 2. `src/components/ecommerce/providers.tsx` — Wire in useDataSync
- Added `DataSyncWrapper` component that calls `useDataSync()`
- Placed inside the provider tree: `SessionProvider > ZustandHydration > DataFetcher > DataSyncWrapper`
- Removed manual `fetchUserData`, `mergeLocalToServer`, `syncWishlistFromServer` calls from `DataFetcher`
- `DataFetcher` now only handles: NextAuth→login() bridge, WebSocket connection, global data fetch
- Removed unused imports (`useCartStore`, `useWishlistStore`)

### 3. `src/store/auth-store.ts` — Remove syncAllStores to prevent double-sync
- Removed `syncAllStores()` function (was calling `fetchUserData` + `mergeLocalToServer`)
- Removed `syncAllStores` calls from `login()` and `register()`
- `useDataSync` is now the single point of data sync — prevents race conditions
- Removed unused imports (`useCartStore`, `useWishlistStore`, `logger`)

## Verified Flows

### Email/password login
1. User submits credentials → `useAuthStore.login()` sets auth state
2. `useDataSync` detects `authStoreIsAuthenticated: true`
3. `useDataSync` calls `fetchUserData`, `mergeLocalToServer`, `syncWishlistFromServer`
4. `fetchUserData` also sets `useAppStore.isAuthenticated: true` (bridge)
5. Data loaded, `isDataLoaded: true`

### Email/password page refresh
1. `useAuthStore` re-initializes from localStorage → `isAuthenticated: true`
2. `useAppStore` has `isAuthenticated: false`, `isDataLoaded: false`
3. `useDataSync` detects `authStoreIsAuthenticated: true`, `effectiveUserId` from authStore
4. `useDataSync` syncs data from server → cart/wishlist are now fresh
5. `fetchUserData` also bridges auth to `useAppStore`

### Google OAuth login
1. `DataFetcher` detects NextAuth session, calls `login()` on `useAppStore`
2. `useAppStore.isAuthenticated` becomes `true`
3. `useDataSync` detects `appStoreIsAuthenticated: true`
4. `useDataSync` syncs data from server

### Logout
1. Either store's `logout()` sets `isAuthenticated: false`
2. When both stores report unauthenticated, `useDataSync` resets `isDataLoaded: false`
3. Next login will re-fetch data

### Cart merge flow (verified correct)
1. `mergeLocalToServer(userId)` merges local items to server via `POST /api/cart?merge=true`
2. On success, calls `syncFromServer(userId)` to replace local state with authoritative server data
3. Locally-added items are preserved (merge), then final state reflects merged result (sync)

### Wishlist sync flow (verified correct)
1. `syncWishlistFromServer(userId)` replaces `wishlistIds` with server data
2. Server is source of truth — correct for authenticated users

## Lint
- `bun run lint` passes with 0 errors
