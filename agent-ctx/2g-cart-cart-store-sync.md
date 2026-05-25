# Task 2g-cart: Cart Store Server Sync Agent

## Summary
Rewrote `/home/z/my-project/src/lib/store/cart.ts` to sync with the server-side Cart API while maintaining full backward compatibility with all existing UI components.

## Changes Made

### File: `src/lib/store/cart.ts`
Complete rewrite with the following architecture:

1. **Backward-compatible interface** — All original methods preserved with identical signatures:
   - `addItem(product, variant?, quantity?)`, `removeItem(id)`, `updateQuantity(id, qty)`, `toggleCheck(id)`, `checkAll(checked)`, `clearCart()`
   - All getters: `getTotalPrice`, `getCheckedTotalPrice`, `getTotalItemCount`, `getCheckedItemCount`, `getCheckedItems`, `getCheckedTotal`, `getCheckedCount`

2. **New methods added to interface**:
   - `syncFromServer(userId: string): Promise<void>` — Fetches cart from `GET /api/cart?userId=xxx`
   - `mergeLocalToServer(userId: string): Promise<void>` — Merges local items via `POST /api/cart?merge=true`, then re-fetches
   - `isSyncing: boolean` — Tracks sync-in-progress state

3. **Dual mode operation**:
   - `isUserAuthenticated()` checks `localStorage.getItem('authToken')`
   - Authenticated → API calls for all mutations, local state kept in sync
   - Unauthenticated → pure localStorage (original behavior)

4. **Optimistic updates with rollback**:
   - Local state updates immediately on every mutation
   - On API failure (network error or non-success response), reverts to pre-mutation snapshot
   - On success for addItem/updateQuantity, replaces optimistic data with server response

5. **Persist middleware** retained with key `martup-cart`

### Helper Utilities
- `mapServerCartItem()` — Maps raw API response to local `CartItem` type
- `getItemPrice()` — Centralized price calculation
- `isUserAuthenticated()` — Token existence check

## Integration Points
- Auth store logout handler (`setCartStoreRef`) continues to work — `clearCart()` now also calls `POST /api/cart?clear=true` when authenticated
- DataFetcher should be updated to call `mergeLocalToServer(userId)` after login for full server sync

## Verification
- `bun run lint` — Zero errors
- Dev server running cleanly
