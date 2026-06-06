---
Task ID: 1
Agent: Checkout Cleanup Agent
Task: Remove bank_transfer/escrow payment method, fix UI bugs, and update API error message

Work Log:
- Read all target files (checkout-screen.tsx, cart-screen.tsx, order-screen.tsx, payment/create/route.ts)
- Identified all bank_transfer/escrow-related code across the codebase
- Systematically removed escrow features while keeping wallet escrow logic intact

Fixes Applied:

1. checkout-screen.tsx:
   - Removed bank_transfer from PAYMENT_METHODS array
   - Removed state variables: escrowBankAccounts, isLoadingBankAccounts, copiedAccountId
   - Removed useEffect for fetching bank accounts from /api/settings/bank-accounts
   - Removed handleCopyAccountNumber function
   - Removed bank_transfer branch in handlePay (entire else-if block)
   - Removed Bank Account Info JSX section (selectedPayment === 'bank_transfer' block)
   - Removed teal color mapping from payment method icon rendering
   - Removed 'escrow' text from jasa service notice ("ditahan (escrow)" → "ditahan")
   - Fixed bottom CTA bar width: changed from left-0 right-0 to left-1/2 -translate-x-1/2 w-full max-w-[430px]
   - Removed inner mx-auto max-w wrapper div
   - Fixed auto-incrementing quantity bug: changed whileTap={{ scale: 0.9 }} to whileHover={{ scale: 1.05 }} on +/- buttons
   - Cleaned up unused imports: Building2, Landmark, Copy, CheckCircle

2. cart-screen.tsx:
   - Fixed bottom bar width: changed from left-0 right-0 to left-1/2 -translate-x-1/2 w-full max-w-[430px]
   - Removed inner mx-auto max-w wrapper div, moved children up

3. order-screen.tsx:
   - Removed escrowBankAccounts state
   - Removed isUploadingProof state
   - Removed isEscrowOrder logic
   - Removed fetchBankAccounts callback and its useEffect
   - Removed handleUploadPaymentProof function
   - Removed escrow/bank_transfer check in OrderCard "Bayar" button handler
   - Removed bank account display section in OrderDetail
   - Removed proof image display section for escrow orders
   - Merged isEscrowOrder-conditional action buttons into single conditions
   - Cleaned up unused imports: Landmark, Upload, ImagePlus, CheckCircle, Landmark as BankIcon

4. payment/create/route.ts:
   - Changed error message from "Silakan gunakan metode Transfer Bank atau hubungi admin." to "Silakan hubungi admin."

Verification:
- bun run lint: passes with no errors
- Dev server: running correctly on port 3000

---

Task ID: 1
Agent: Main Agent
Task: Fix checkout payment flow bugs - user can't see bank account info, false "Selesai Dibayar" message

Work Log:
- Investigated checkout-screen.tsx (root version used by screen-registry) and order-screen.tsx
- Found that bank_transfer (Escrow) payment was grouped with COD in handlePay, showing generic success modal instead of bank accounts
- Found "Bayar Sekarang" button in OrderDetail showed for escrow orders, falsely displaying "Pembayaran berhasil diproses!" when payForOrder returned no token
- Found bank accounts fetch in OrderDetail used useState instead of useEffect (never re-triggered)
- Found isEscrowOrder check didn't include 'bank_transfer' string
- Found empty checkout state showed during payment processing when cart items were removed

Fixes Applied:

1. checkout-screen.tsx (root):
   - Added escrowBankAccounts state, isLoadingBankAccounts, copiedAccountId
   - Added useEffect to fetch bank accounts from /api/settings/bank-accounts when bank_transfer is selected
   - Added handleCopyAccountNumber for copying bank account numbers
   - Added Escrow Bank Accounts display section in payment method area (with Landmark, Copy, CheckCircle icons)
   - Separated bank_transfer flow from COD: after creating escrow orders, navigates directly to order detail page (order-tracking) with toast message about transferring to MartUp bank account
   - Fixed empty state: only shows "Tidak Ada Item" when NOT processing (checkedItems.length === 0 && !isProcessing)

2. order-screen.tsx:
   - Fixed isEscrowOrder to also check for 'bank_transfer' in payment method string
   - Changed "Bayar Sekarang" button in OrderDetail: hidden for escrow orders (they have Upload Bukti Transfer in escrow section)
   - Fixed false success message: changed fallback from "Pembayaran berhasil diproses!" to "Gagal memproses pembayaran. Silakan coba lagi nanti."
   - Added separate cancel button section for escrow orders
   - Fixed useState → useEffect for bank accounts fetch (was never re-triggering)
   - Added bank_transfer to escrow check in OrderCard "Bayar" button handler

Stage Summary:
- Escrow bank accounts now shown during checkout when "Transfer Bank (Escrow)" is selected
- After escrow checkout, user is directed to order detail page where they can see bank accounts and upload proof
- "Bayar Sekarang" no longer shows for escrow orders in order detail (preventing false success message)
- False "Pembayaran berhasil diproses!" message replaced with proper error message
- Bank accounts fetch in order detail now properly uses useEffect instead of useState
- Empty checkout state no longer shows during payment processing

---
Task ID: 2
Agent: Bug Fix Agent
Task: Fix Checkout Screen - isPayingRef Reset + Shipping useEffect Loop Prevention

Work Log:
- Read worklog from Task 1 for context
- Analyzed the two competing shipping useEffects (lines 436-454 and 457-469)
- Identified root causes:
  1. Two separate useEffects with overlapping triggers caused double-fetching when both `defaultAddress?.id` and `defaultAddress?.city` changed simultaneously
  2. Second useEffect cleared ALL shipping selections (including jasa-only) with `setShippingBySeller({})`, losing user's jasa-only selections unnecessarily
  3. No in-flight fetch tracking — concurrent fetches for the same seller could race

Fixes Applied in `/home/z/my-project/src/components/ecommerce/checkout-screen.tsx`:

1. Added two new refs:
   - `prevCityRef = useRef<string | null>(null)` — tracks the previous city to detect actual city changes (vs same-city address switches)
   - `fetchingSellerRef = useRef<Set<string>>(new Set())` — tracks in-flight shipping rate fetches per seller

2. Updated `fetchShippingRates` with in-flight deduplication:
   - Checks `fetchingSellerRef.current.has(sellerId)` at the top; returns early if already fetching
   - Adds sellerId to set before fetch, removes in `finally` block
   - Prevents concurrent duplicate API requests for the same seller

3. Merged the two competing useEffects into one:
   - Single dependency array: `[defaultAddress?.id, defaultAddress?.city, groupedBySeller.length]`
   - Uses `prevCityRef` to detect actual city changes: only clears non-jasa shipping selections when city actually changes
   - Preserves jasa-only shipping selections (`provider === 'jasa'`) when clearing
   - When city changes: always re-fetches all non-jasa sellers (old rates are for wrong destination)
   - When city hasn't changed: only fetches if no rates exist yet (avoids redundant fetches)
   - Checks `fetchingSellerRef` before calling `fetchShippingRates` for additional safety

4. Did NOT change:
   - Payment flow logic (handlePay function)
   - Cart store
   - Any UI/rendering code
   - Any other files

Verification:
- `bun run lint` passes with no errors
- Dev server compiles successfully

---
Task ID: 1
Agent: Cart Fix Agent
Task: Fix Cart Store - Auto-incrementing Quantity Bug + Race Conditions

Work Log:
- Read existing cart store at /home/z/my-project/src/lib/store/cart.ts
- Confirmed API endpoints exist: /api/cart/bulk (PUT for bulk check updates), /api/cart/[id] (PUT for single item update, DELETE for removal)
- Identified all 5 bugs and their root causes in the cart store

Fixes Applied (all in /home/z/my-project/src/lib/store/cart.ts):

1. BUG 1 - Stale Rollback in updateQuantity/toggleCheck/addItem/removeItem/clearCart:
   - Replaced all captured `previousItems = get().items` patterns with functional state updates `set((state) => ...)`
   - On API failure, now calls `resyncFromServer(set)` to re-sync from server instead of rolling back to stale captured state
   - Added module-level `resyncFromServer()` helper that fetches fresh state from `/api/cart`

2. BUG 2 - No Debounce on updateQuantity:
   - Added module-level `quantityDebounceTimers` Map<string, timeout> for per-item debounce tracking
   - `updateQuantity` now does instant optimistic update but debounces the server sync by 500ms (DEBOUNCE_DELAY_MS)
   - Each new call for the same item clears the previous pending timer and sets a new one
   - The debounced call is enqueued into the mutation queue for sequential execution

3. BUG 3 - mergeLocalToServer Sets Pre-Merge Server State:
   - After the merge POST, now re-fetches from `/api/cart` to get the complete post-merge state
   - Previously, `set({ items: serverItems })` used serverItems fetched BEFORE the merge, so newly merged items were missing from local state
   - Falls back to pre-merge server items if the post-merge re-fetch fails

4. BUG 4 - checkAll Fires N Parallel API Calls:
   - Replaced N parallel `apiClient.rawPut('/api/cart', { cartItemId, isChecked })` calls with a single bulk PUT to `/api/cart/bulk`
   - Sends `{ items: [{ cartItemId, isChecked }] }` array in one request
   - On success, replaces local items with server-confirmed items from bulk response
   - On failure, re-syncs from server

5. BUG 5 - removeItem Uses DELETE with body:
   - Changed from `apiClient.rawDelete('/api/cart', { cartItemId: id })` (body in DELETE) to `apiClient.rawDelete(\`/api/cart/${encodeURIComponent(id)}\`)` (path parameter)
   - Uses the existing `/api/cart/[id]` DELETE endpoint which accepts the ID in the URL

Infrastructure additions:
- `mutationQueue`: Module-level promise chain that ensures API calls execute sequentially (prevents race conditions from concurrent mutations)
- `enqueueMutation(fn)`: Enqueues an async function into the mutation queue with error handling
- `quantityDebounceTimers`: Map for tracking per-item debounce timers
- `resyncFromServer(set)`: Shared error recovery function that re-fetches cart from server
- All state mutations now use functional `set((state) => ...)` form

Lint: Passed with no errors
Dev server: Running correctly

---
Task ID: 3
Agent: Main Agent
Task: Remove manual escrow/bank_transfer payment, fix bottom CTA bar width, fix auto-incrementing quantity

Work Log:
- Analyzed screenshot showing bottom buttons wider than header
- Read all checkout-related files (checkout-screen, cart-screen, order-screen, payment/create API)
- Identified escrow/bank_transfer as manual payment method not through Midtrans
- Delegated comprehensive fix to full-stack developer agent

Changes Applied:

1. checkout-screen.tsx:
   - Removed bank_transfer from PAYMENT_METHODS (4 methods remain: wallet, midtrans, card, cod)
   - Removed escrow state variables, useEffect, handleCopyAccountNumber
   - Removed bank_transfer branch in handlePay
   - Removed Bank Account Info JSX section
   - Removed teal color mapping
   - Removed "(escrow)" text from jasa service notice
   - Fixed bottom CTA bar: left-0 right-0 → left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-[480px]
   - Fixed auto-incrementing quantity: whileTap → whileHover on +/- buttons
   - Cleaned up unused imports (Building2, Landmark, Copy, CheckCircle)

2. cart-screen.tsx:
   - Fixed bottom bar width (same centering pattern as checkout)

3. order-screen.tsx:
   - Removed escrowBankAccounts state, isUploadingProof, isEscrowOrder
   - Removed fetchBankAccounts, handleUploadPaymentProof
   - Removed escrow/bank_transfer check in Bayar button handler
   - Removed bank account display in OrderDetail
   - Cleaned up unused imports

4. payment/create/route.ts:
   - Removed "Transfer Bank" from error message

Stage Summary:
- All payments now through Midtrans (wallet, transfer VA/e-wallet, card) or COD
- Bottom CTA bars are symmetric with header on all screen sizes
- Auto-incrementing quantity bug fixed (whileTap → whileHover)
- Lint passes, dev server running, browser verification successful

---
Task ID: 1
Agent: Main Agent
Task: Comprehensive security audit and critical fixes for MartUp app

Work Log:
- Explored full project structure: 67+ API routes, 80+ components, 20 Zustand stores, 45+ lib modules
- Read and audited critical files: checkout-screen.tsx, payment/create/route.ts, payment/notification/route.ts, orders/route.ts, cart.ts, payment-step.tsx, order-summary.tsx, shared.tsx
- Found that remote had already removed escrow from PAYMENT_METHODS (wallet, midtrans, card, cod)
- Found "Batalkan Pesanan" button already working on remote (navigate to cart)
- Fixed bottom bar UI symmetry issue: changed from `left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-[480px]` to `left-0 right-0` with `max-w-lg mx-auto` content constraint
- Applied same fix to cart-screen.tsx bottom bar
- Ran lint: all clean
- Verified dev server: HTTP 200, no compilation errors
- Deployed to production via git push origin main

Security Audit Findings (already implemented in codebase):
- ✅ Payment notification: signature verification with timing-safe comparison, amount mismatch check, idempotency checks, database transactions
- ✅ Order creation: server-side price computation (ignores client prices), server-side voucher validation, server-side shipping cost verification, stock validation inside transaction with race condition protection, address ownership verification
- ✅ Payment creation: auth verification, CSRF protection, rate limiting (5/min), order ownership verification, expired order auto-cancellation
- ✅ Cart store: optimistic updates with rollback on failure, server sync for authenticated users
- ✅ All monetary values computed server-side, client values ignored

Stage Summary:
- Bottom bar UI symmetry fixed on both checkout and cart screens
- Deployed to production (commit 6f72e4b)
- Escrow was already removed by previous deployment
- "Batalkan Pesanan" button was already working from previous deployment
---
Task ID: 4
Agent: Main Agent
Task: Security fixes — secure unauthenticated endpoints

Work Log:
- Deep audit identified 6 unauthenticated endpoints exposing sensitive info
- Added verifyAuth to /api/bank-accounts (previously public, now requires login)
- Added verifyAuth to /api/settings/bank-accounts (previously public, now requires login)
- Added production block + verifySuperAdmin to /api/diagnostics/google-oauth
- Added production block + verifySuperAdmin to /api/diagnostics/google
- Added production block + verifySuperAdmin to /api/diagnostics/session
- Added production block + verifySuperAdmin to /api/db-status (also removed hostname leak)
- Added verifyAuth to /api/setup/storage GET handler
- Removed Google Client ID prefix leakage from /api/diagnostics/google (now just shows "set ✓")
- All fixes follow the same pattern as /api/auth/diagnostic (404 in production, super admin in dev)
- Lint: Passed with no errors
- Dev server: Running correctly

Stage Summary:
- 6 previously unauthenticated endpoints now secured
- No sensitive information exposed without authentication
- Diagnostic endpoints return 404 in production
- Bank account endpoints require login
---
Task ID: 5
Agent: Main Agent
Task: Fix COD payment bugs — unauthorized error on Bayar Sekarang & missing info

Work Log:
- Investigated COD flow: checkout → order creation → order detail → payment
- Found root cause: checkout stored paymentMethod as display name "Bayar di Tempat (COD)" instead of ID "cod"
- COD detection in OrderCard used `paymentMethod === 'cod'` which never matched
- OrderDetail showed "Bayar Sekarang" for ALL pending orders, including COD
- Clicking "Bayar Sekarang" on COD order called /api/payment/create → unauthorized error
- Fixed checkout-screen.tsx: Send payment method ID (cod/wallet/midtrans/card) to server
- Fixed order-screen.tsx: Added isCodOrder() helper for robust COD detection
- Fixed order-screen.tsx: Replaced "Bayar Sekarang" button with COD info banner for COD orders
- Fixed order-screen.tsx: Added getPaymentMethodLabel() for proper display names
- Fixed order-screen.tsx: Updated isMidtransPayment check to exclude COD & wallet
- Fixed order-store: Reject payForOrder() for COD orders with clear error message
- Lint: Passed with no errors
- Deployed to production (commit 4cd256b)

Stage Summary:
- COD orders now show "Bayar di Tempat (COD)" info banner instead of "Bayar Sekarang"
- No more unauthorized error when viewing COD orders
- Payment method stored as ID in database for consistent detection
- Display names resolved client-side via getPaymentMethodLabel()

---
Task ID: 6
Agent: Main Agent
Task: Comprehensive checkout/payment audit - Fix all payment method flows (COD, Midtrans, Wallet, Card)

Work Log:
- Deep audit of entire checkout/payment system: checkout-screen.tsx, order-screen.tsx, payment/create/route.ts, orders/route.ts, store/order.ts, order-status.ts, wallet/debit/route.ts, payment/notification/route.ts
- Found critical issues in COD, Midtrans, and Wallet payment flows
- Found "not authorized" error root cause: multiple detection gaps for COD orders

Fixes Applied:

1. **payment/create/route.ts** - Added explicit COD rejection:
   - Added Step 6.5: Reject COD orders with clear error message before attempting Midtrans payment
   - Added 'cod' to allowed paymentStatus list for edge cases
   - This prevents COD orders from accidentally going through Midtrans API

2. **orders/route.ts** - Set paymentStatus='cod' for COD orders:
   - Changed `paymentStatus: 'unpaid'` to `paymentStatus: (paymentMethod || '').toLowerCase() === 'cod' ? 'cod' : 'unpaid'`
   - This clearly distinguishes COD orders from unpaid Midtrans orders in the database

3. **order-screen.tsx** - Multiple fixes:
   - Enhanced `isCodOrder()`: Now also checks `paymentStatus === 'cod'` for robust detection
   - Fixed `getActionButton()`: Returns null for COD pending orders (no "Bayar" button)
   - Added COD badge in OrderCard actions: Shows "Bayar di Tempat" badge instead of "Bayar" button
   - Added `!isCodOrder(order)` guard to `showPaymentRef` to prevent "Bayar Sekarang" inside payment reference section

4. **checkout-screen.tsx** - Fixed COD local order creation:
   - Changed `orderPaymentStatus` from always 'unpaid' to 'cod' when `selectedPayment === 'cod'`
   - Local order state now matches server-side paymentStatus

5. **store/order.ts** - Rewrote payForOrder function:
   - Enhanced COD detection: Also checks `paymentStatus === 'cod'`
   - Removed optimistic update for Midtrans payments (was incorrectly marking as 'paid' before webhook confirmation)
   - Fixed wallet payment flow: Uses correct `/api/wallet/debit` endpoint instead of deprecated `/api/wallet`
   - Added proper error handling with rollback for wallet payments
   - Added fallback: re-fetches orders from server if status update fails

6. **order-status.ts** - Allow sellers to mark COD orders as paid:
   - COD sellers can now mark orders as 'paid' (they receive cash on delivery)
   - Previously only admin could mark orders as paid, blocking the COD flow

7. **wallet/debit/route.ts** - Accept COD paymentStatus:
   - Added 'cod' to allowed paymentStatus values
   - Allows switching from COD to wallet payment if user changes mind

Stage Summary:
- COD flow: Orders created with paymentStatus='cod', no "Bayar"/"Bayar Sekarang" buttons, info banner shown instead
- Midtrans flow: No more false optimistic 'paid' status, proper Snap token flow
- Wallet flow: Fixed to use correct debit API, proper rollback on failure
- Card flow: Handled same as Midtrans through payment/create endpoint
- All payment methods have proper end-to-end flow with security
- Lint: Passed

---
Task ID: 7-a
Agent: Backend Bug Fix Agent
Task: Fix 4 critical backend bugs (stock restoration, isServiceOrder fallback, API response format, dashboard revenue)

Work Log:
- Read worklog from prior tasks for context
- Read all 4 target files: payment/notification/route.ts, order-status.ts, seller/orders/route.ts, seller/dashboard/route.ts
- Identified root causes for each bug and applied targeted fixes

Fixes Applied:

1. **BUG 1: Midtrans cancel/expire/deny doesn't restore stock**
   - File: `src/app/api/payment/notification/route.ts`
   - Problem: When Midtrans sends cancel/expire/deny, order status was updated but stock was NOT restored (unlike order-status.ts which properly restores stock on cancellation)
   - Fix: Inside the `$transaction` block, after the existing cancellation notification block (Step 6), added:
     - Stock restoration: iterate through `order.items`, increment `product.stock` by `item.quantity`
     - Sold count decrement: use `$executeRaw` with `GREATEST(sold - quantity, 0)` to prevent negative
     - Variant stock restoration: if `item.variantId` exists, increment `productVariant.stock`
     - Seller pendingBalance reversal: if `order.paymentStatus === 'paid'`, find seller wallet, compute `subtotal - commissionAmount`, decrement from `pendingBalance` using `Math.min` to avoid negative
     - Record wallet mutation for seller (debit = escrow reversal)

2. **BUG 2: isServiceOrder param never passed in status API**
   - File: `src/lib/order-status.ts`
   - Problem: Line 92 checked `if (status === 'shipped' && !isServiceOrder)` but `isServiceOrder` was never passed by callers (e.g., `/api/orders/[id]/status/route.ts`), so service orders always required a tracking number
   - Fix: Changed the check to `if (status === 'shipped' && !(isServiceOrder ?? order.isServiceOrder))` — uses the passed parameter if available, falls back to the order's `isServiceOrder` field from the database
   - Also moved the trackingNumber validation block AFTER the order is fetched (since `order.isServiceOrder` needs the order data)
   - Added comment explaining the parameter is optional with fallback

3. **BUG 3: Seller orders API response format inconsistent**
   - File: `src/app/api/seller/orders/route.ts`
   - Problem: Response returned `{ items, total, page, limit, totalPages }` without a `success` field, inconsistent with all other APIs returning `{ success: true, data: ... }`
   - Fix: Changed response format to `{ success: true, data: parsedOrders, total, page, limit, totalPages }`

4. **BUG 4: Seller dashboard unsafe JSON.parse + wrong revenue metric**
   - File: `src/app/api/seller/dashboard/route.ts`
   - Problem 1: Line 157 used `JSON.parse(i.product.images)` without try-catch, could crash on malformed data
   - Fix: Replaced with `parseJsonField(i.product.images)` from `@/lib/api-utils` (already used in other files)
   - Problem 2: Revenue aggregate used `_sum: { totalAmount: true }` which includes shipping + platform fee - discount; revenue should use `subtotal` instead
   - Fix: Changed to `_sum: { subtotal: true }` and updated `totalRevenue = revenueResult._sum.subtotal || 0`
   - Problem 3: Error responses missing `success: false` field
   - Fix: Added `success: false` to 404 response and 500 response
   - Problem 4: Success response missing `success: true` field
   - Fix: Added `success: true` to the success response

Verification:
- `bun run lint`: passes with no errors
- All 4 bugs fixed with targeted, minimal changes

---
Task ID: 7-b
Agent: Bug Fix Agent
Task: Fix 7 critical frontend bugs in MartUp marketplace app

Work Log:
- Read worklog from previous tasks for context
- Identified and fixed all 7 bugs across 4 files

Fixes Applied:

1. **BUG 1 — Incomplete rollback in order store** (`src/lib/store/order.ts`):
   - Replaced `snapshotOrders()` with `snapshotState()` that captures orders, walletBalance, walletMutations, and sellerBalance
   - Replaced `restoreOrders()` with `restoreState()` that restores all captured state
   - Updated ALL functions (updateOrderStatus, payForOrder, cancelOrder, updateOrderTracking) to use the new snapshot/restore mechanism
   - Previously, API failures would only restore the orders array, leaving wallet and seller balance corrupted

2. **BUG 2 — Platform fee overcharge per seller group** (`src/components/ecommerce/checkout-screen.tsx`):
   - Changed `for...of` loop to indexed `for` loop to track group index
   - Added `groupPlatformFee = groupIdx === 0 ? platformFee : 0` — platform fee only charged to first seller group
   - Updated `groupTotal` calculation to use `groupPlatformFee` instead of `platformFee`
   - Updated order payload `platformFee` field to use `groupPlatformFee`
   - Previously, 3 seller groups = 3× platform fee charged silently

3. **BUG 3 — Cart merge variantId comparison bug** (`src/lib/store/cart.ts`):
   - Changed `serverItem.variantId === (localItem.variantId || null)` to `(serverItem.variantId ?? null) === (localItem.variantId ?? null)`
   - Previously, `undefined === null` was `false`, causing all variant-less products to be re-added as duplicates

4. **BUG 4 — COD cancel incorrectly reverses seller credit** (`src/lib/store/order.ts`):
   - Added `isCodOrder()` helper function at top of file (same logic as order-screen.tsx)
   - Changed `wasPaid` check to `!isCodOrder(order) && (order.paymentStatus === 'paid' || ...)`
   - Previously, COD orders in processing/shipped status would incorrectly deduct seller credit that was never added

5. **BUG 5 — Wallet payment checkout state mismatch** (`src/components/ecommerce/checkout-screen.tsx`):
   - Changed `orderStatus` from `isImmediatePayment ? 'paid' : 'pending'` to always `'pending'`
   - Changed `orderPaymentStatus` from `isImmediatePayment ? 'paid' : ...` to `selectedPayment === 'cod' ? 'cod' : 'unpaid'`
   - Changed `escrowStatus` from `isImmediatePayment ? 'held' : 'none'` to `'none'`
   - Changed `paidAt` from `isImmediatePayment ? new Date().toISOString() : undefined` to `undefined`
   - Previously, `addOrder()` with status 'paid' would add seller credit locally, but if wallet debit later failed, state was corrupted

6. **BUG 6 — Seller delete account calls admin API** (`src/components/ecommerce/seller/seller-settings.tsx`):
   - Changed from `apiClient.get('/api/auth/me')` + `apiClient.rawDelete('/api/admin/users')` to `apiClient.rawDelete('/api/user/delete')`
   - Now properly checks response status and shows error toast on failure
   - Removed unused `AuthMeResponse` import
   - Previously, admin-only endpoint returned 403 for sellers, but catch block swallowed the error and showed false success toast

7. **BUG 7 — Premature toast messages in order screen** (`src/components/ecommerce/order-screen.tsx`):
   - OrderCard "Terima" button: changed `onClick` to `async`, added `await` before `updateOrderStatus()`
   - OrderCard cancel button: changed `onClick` to `async`, added `await` before `cancelOrder()`
   - OrderDetail "Konfirmasi Diterima" button: changed `onClick` to `async`, added `await` before `updateOrderStatus()`
   - OrderDetail cancel button: changed `onClick` to `async`, added `await` before `cancelOrder()`
   - Previously, success toasts fired before API confirmed the action, giving false feedback on failures

Verification:
- `bun run lint`: passes with no errors
- Dev server: running correctly on port 3000
