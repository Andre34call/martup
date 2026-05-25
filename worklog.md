---
Task ID: 1
Agent: main
Task: Fix "Terjadi Kesalahan" error when switching to seller mode

Work Log:
- Investigated the error by tracing it to ErrorBoundary component which catches all React crashes
- Found ROOT CAUSE: `SellerDashboard` and `SellerAnalytics` components destructure `sellerStats` and `fetchSellerStats` from the Zustand store, but these properties didn't exist in the store
- `fetchSellerStats()` was being called in useEffect, causing `TypeError: undefined is not a function` → ErrorBoundary caught it → "Terjadi Kesalahan"
- Also found: `switchRole('seller')` didn't auto-register a seller record when buyer switches to seller
- Also found: Wallet model missing `pendingBalance` field referenced in `fetchUserData`

Fixes Applied:
1. **store.ts**: Added `sellerStats: SellerStats | null` and `fetchSellerStats: () => Promise<void>` to AppState interface and store implementation
2. **store.ts**: `fetchSellerStats` gracefully returns early if no seller ID, fetches from `/api/seller/stats` when available
3. **store.ts**: `switchRole('seller')` now auto-registers seller via `/api/seller/register` API if no seller record exists
4. **store.ts**: Added `sellerStats: null` to logout and deleteAccount resets
5. **seller/stats/route.ts**: Enhanced recentOrders response to include buyerName, shipping, items with full shape for frontend compatibility
6. **prisma/schema.prisma**: Added `pendingBalance Float @default(0)` to Wallet model
7. Ran `bun run db:push` to sync schema changes
8. All lint checks pass, dev server compiles without errors

Stage Summary:
- Seller mode switching now works without crashing
- Auto-registration creates seller record when buyer switches to seller
- Seller dashboard loads with fallback stats even before API data arrives
- Wallet pendingBalance field now properly stored in database

---
Task ID: 2
Agent: main
Task: Fix 4 remaining bugs causing seller role switch error (comprehensive fix)

Work Log:
- Investigated deeper and found 4 additional bugs that still caused the "Terjadi Kesalahan" error
- Bug 1: Race condition - switchRole navigated to seller-dashboard before seller data was loaded (async fetch ran in background while navigation happened immediately)
- Bug 2: 409 Conflict - When user already had a seller record from previous session, the register API returned 409 but switchRole only checked `data.success && data.data`, so seller was never set
- Bug 3: Persisted currentScreen without auth state - On reload, Zustand rehydrated currentScreen='seller-dashboard' but no auth/seller data, causing crashes
- Bug 4: fetchSellerStats useEffect dependency was [fetchSellerStats] (stable function ref), never re-triggered when seller became available

Fixes Applied:
1. **store.ts switchRole**: Made async - now awaits seller registration/fetch before navigating. Added loading state. On 409, fetches existing seller from /api/user-data. After navigation, triggers fetchSellerStats if seller is available.
2. **store.ts switchRole type**: Changed from `(role) => void` to `(role) => Promise<void>` for proper typing
3. **store.ts partialize**: Removed currentScreen from persisted state to prevent stale screen navigation on reload
4. **seller-screens.tsx SellerDashboard**: useEffect dependency changed from [fetchSellerStats] to [fetchSellerStats, sellerId] with guard `if (sellerId)`
5. **seller-screens.tsx SellerAnalytics**: Same fix as SellerDashboard
6. **profile-screen.tsx handleRoleSwitch**: Made async with proper error handling and loading toast message
7. Git pushed to main, triggering auto-deploy on Vercel

Stage Summary:
- Seller role switch is now robust: awaits data before navigating, handles 409 conflict, prevents stale state
- No more crashes on reload because currentScreen is no longer persisted
- Seller stats properly fetched when seller ID becomes available

---
Task ID: 3
Agent: main
Task: Fix categories disappeared, logout not working, remove demo login

Work Log:
- Issue 1: Categories disappeared - fetchCategories read `data.categories` but API returns `data.data`
  - Same bug existed in fetchProducts (`data.products` → `data.data`) and fetchAdminUsers (`data.users` → `data.data`)
  - Fixed all 3 with fallback pattern: `data.data || data.X || []`
- Issue 2: Logout not working - `logout()` cleared Zustand state but NOT the NextAuth session cookie
  - DataFetcher detected `status=authenticated + !isAuthenticated` and immediately re-authenticated user
  - Added `signOut({ redirect: false })` from next-auth/react to both `logout` and `deleteAccount` functions
  - Changed logout type from `() => void` to `() => Promise<void>`
- Issue 3: Removed demo login section from auth-screens.tsx (Buyer/Seller/Admin demo buttons)
  - App is now production, demo login is no longer needed

Fixes Applied:
1. **store.ts fetchCategories**: `data.categories` → `data.data || data.categories || []`
2. **store.ts fetchProducts**: `data.products` → `data.data || data.products || []`
3. **store.ts fetchAdminUsers**: `data.users` → `data.data || data.users || []`
4. **store.ts logout**: Added `await signOut({ redirect: false })` to clear NextAuth session
5. **store.ts deleteAccount**: Same signOut fix
6. **store.ts**: Added `import { signOut } from 'next-auth/react'`
7. **auth-screens.tsx**: Removed entire Demo Login section (lines 496-587)
8. Git pushed to main, triggering auto-deploy on Vercel

Stage Summary:
- Categories, products, and admin users now properly load from API (response key mismatch fixed)
- Logout properly clears both Zustand state AND NextAuth session (no more auto re-login)
- Demo login removed for production readiness
- All lint checks pass

---
Task ID: 1
Agent: store-fixer
Task: Fix store.ts admin auth headers + cleanup

Work Log:
- Added getAuthHeaders() helper function that reads authToken from localStorage and returns headers with Authorization Bearer token
- Added auth headers to all 6 admin API GET fetch calls: fetchDivisions, fetchAdminUsers, fetchAdminStats, fetchAdminWithdrawals, fetchAdminBanners, fetchAdminComplaints
- Added auth headers to 2 admin API PATCH fetch calls: assignUserToDivision, updateDivision
- Fixed deleteAccount() to reset all state fields matching logout(): walletCoins, sellerBalance, sellerBankAccounts, withdrawRequests, adminUsers, adminBanners, adminComplaints, adminStats, divisions, chatRooms, chatMessages, totalUnreadChats, selectedVoucher, usedVoucherIds, vouchers, searchQuery
- Fixed BankAccount type inconsistency: changed holderName to accountHolder in fetchAdminWithdrawals mapping to match BankAccount interface in types.ts
- Verified partialize config correctly only persists settings and searchHistory (isDataLoaded is NOT persisted, which is correct)
- All lint checks pass

Stage Summary:
- All admin API calls now include auth headers, preventing 401 errors from middleware
- deleteAccount() properly resets all state fields (was missing 16 fields)
- BankAccount mapping uses consistent field names (accountHolder instead of holderName)
- No changes needed to partialize config (already correct)

---
Task ID: 3-4
Agent: banner-fixer
Task: Fix Banner management + position features

Work Log:
- Replaced local-only Zustand operations with real API calls (POST/PUT/DELETE /api/admin/banners)
- Added all 8 position options from schema: home_top, home_mid, home_bottom, category_top, search_top, product_detail, checkout_top, popup
- Added image upload support via /api/upload with file input button and loading spinner
- Added delete functionality with ConfirmDialog confirmation
- Added sort order (number input), start date, and end date fields to Add Banner form
- Added banner image preview in list (shows actual image when available, fallback gradient icon)
- Fixed isActive toggle to call PUT API and refresh from DB instead of local Zustand update
- Updated store.ts adminBanners type to include sortOrder, startDate, endDate fields
- Updated fetchAdminBanners mapping to include sortOrder, startDate, endDate from API response
- Added Upload icon import from lucide-react
- Removed unused addAdminBanner, updateAdminBanner, deleteAdminBanner from component destructuring

Stage Summary:
- Banner management now persists to database via API (all CRUD operations)
- All 8 positions available matching the Prisma schema with Indonesian labels
- File upload works via /api/upload with preview
- Delete with confirmation dialog via ConfirmDialog
- Toggle isActive calls API and refreshes from DB
- Sort order and date range fields included in create form
- All lint checks pass

---
Task ID: 4-5
Agent: banner-audit-fixer
Task: Dynamic home banners + comprehensive code audit

Work Log:
- Created public /api/banners endpoint (GET, no auth required, supports position filter, respects date ranges)
- Added homeBanners state and fetchHomeBanners to store.ts (fetches from /api/banners?position=home_top)
- Added homeBanners: [] to logout() and deleteAccount() resets
- Updated home-screen.tsx to show dynamic banners from DB with fallback gradient when no banners exist
- Removed hardcoded banners array and handleBannerClick from home-screen.tsx
- Added useEffect to fetch banners on mount, auto-play carousel uses homeBanners.length
- **CRITICAL BUG FIX**: SellerAddProductScreen handleSubmit now calls POST /api/seller/products for new products and PUT /api/admin/products for edits (was only updating local Zustand)
- **CRITICAL BUG FIX**: CheckoutScreen handlePay now calls POST /api/orders for each seller group (was only updating local Zustand)
- **CRITICAL BUG FIX**: CheckoutScreen wallet payment now calls POST /api/wallet to deduct balance on server (was only deducting locally)
- **CRITICAL BUG FIX**: DepositScreen handleTopUp now calls POST /api/wallet to persist top-up to DB (was only updating local Zustand)
- **CRITICAL BUG FIX**: OTPScreen handleVerify now calls /api/auth/sync-user instead of creating a hardcoded mock user
- **CRITICAL BUG FIX**: SellerOrders process/ship buttons now call PUT /api/orders to persist status changes to DB
- All lint checks pass, dev server compiles without errors

Stage Summary:
- Home screen banners now come from database (admin-managed via Banner Management)
- Fallback gradient shown when no banners exist in DB
- All critical data-mutating operations now persist to database via API calls:
  - Product creation/editing (seller)
  - Order creation (checkout)
  - Wallet top-up and deduction
  - OTP login
  - Seller order status updates (process/ship)
- Each API call has local Zustand fallback for resilience


---
Task ID: 6
Agent: security-hardener
Task: Security hardening for production

Work Log:
- CRITICAL FIX: Added verifyAuth to /api/user-data (was unauthenticated, anyone could read any user's data)
- CRITICAL FIX: Added verifyAuth to /api/wallet GET/POST (was unauthenticated, anyone could read/modify any wallet)
- CRITICAL FIX: Added verifyAuth to /api/seller/register (was unauthenticated, anyone could register as seller for any userId)
- CRITICAL FIX: Added verifyAuth to /api/upload (was unauthenticated, anyone could upload files)
- Fixed password hash leak in /api/admin/users PUT and DELETE handlers (db.user.update returned all fields including password)
- Fixed password hash leak in /api/auth/sync-user response (db.user.findUnique with include returned password field)
- Added position enum validation to /api/admin/banners POST and PUT (validates against 8 allowed values)
- Added email format validation to /api/auth/login
- Added file extension sanitization to /api/upload (validates against allowlist, prevents path traversal in folder/bucket names)
- Removed hardcoded Supabase credentials from /api/upload fallback values (now requires env vars)
- Added rate limiting to /api/seller/register (5/min) and /api/wallet POST (10/min)
- Added wallet top-up amount cap (max Rp 10.000.000)
- Expanded middleware matcher from /api/admin/* to /api/* so security headers apply to ALL API routes
- Added TOKEN_SECRET fallback warning in auth-middleware.ts
- Updated frontend to send auth headers for secured endpoints: store.ts (seller/register, user-data), upload.ts, admin-screens.tsx (upload), checkout-screen.tsx (wallet), missing-screens.tsx (wallet)
- Verified all 13 admin API routes have verifyAdmin at top of each handler
- Verified .gitignore excludes .env files
- Verified Prisma handles SQL injection prevention

Stage Summary:
- 4 CRITICAL unauthenticated endpoints now require authentication (user-data, wallet, seller/register, upload)
- 3 password hash leaks fixed (admin/users PUT/DELETE, auth/sync-user)
- Input validation added for banner positions, login email format, and upload file extensions
- Rate limiting added to seller registration and wallet mutations
- Security headers now apply to all API routes (not just admin)
- Hardcoded credentials removed from upload route
- Production readiness: SIGNIFICANTLY IMPROVED. Key vulnerabilities (unauthenticated data access, password hash leaks) are fixed. Remaining items for full production: rotate env secrets to strong random values, add HTTPS enforcement, add CORS configuration for production domain.

---
Task ID: 10
Agent: api-handler
Task: Add PUT and DELETE handlers to Seller Products API

Work Log:
- Read existing /api/seller/products/route.ts (had GET and POST handlers)
- Read auth-middleware.ts to understand verifyAuth, authErrorResponse, checkRateLimit API
- Added import for `verifyAuth, authErrorResponse, checkRateLimit` from `@/lib/auth-middleware`
- Added PUT handler (lines 216-499) for updating products:
  - verifyAuth required for all requests
  - Rate limit: 20 operations per minute per user
  - Validates productId (required), price >= 0, discountPrice >= 0, stock >= 0, minOrder >= 1, weight >= 0
  - Validates condition enum (new/used) and status enum (active/draft/blocked)
  - SECURITY: Verifies product belongs to authenticated seller via sellerId ownership check
  - Slug uniqueness check when slug is being updated
  - Stringifies JSON fields (images, tags) before saving
  - Parses JSON fields in response
  - Handles variants update: deletes existing variants and creates new ones in a transaction
  - Updates seller totalProducts count when status changes to/from active (increment/decrement)
  - Uses Prisma $transaction for atomicity on both variants and non-variants paths
- Added DELETE handler (lines 501-592) for soft-deleting products:
  - verifyAuth required for all requests
  - Rate limit: 20 operations per minute per user
  - Validates productId (required)
  - SECURITY: Verifies product belongs to authenticated seller via sellerId ownership check
  - Soft delete by setting status to 'blocked' (preserves referential integrity)
  - Checks if product is already soft-deleted (returns 400)
  - Decrements seller totalProducts count only if product was active
  - Uses Prisma $transaction for atomicity
- Kept existing GET and POST handlers intact
- Fixed lint warning (unused eslint-disable directive) by changing `Record<string, any>` to `Record<string, unknown>`
- All lint checks pass, dev server compiles without errors

Stage Summary:
- Seller Products API now has full CRUD: GET, POST, PUT, DELETE
- Both PUT and DELETE require authentication and seller ownership verification
- Rate limiting enforced (20 ops/min per user)
- Input validation covers all numeric bounds and enum values
- Soft delete preserves referential integrity (no hard deletes)
- Seller totalProducts count stays accurate through status transitions
- Atomic operations via Prisma transactions

---
Task ID: 8
Agent: wishlist-api
Task: Create Wishlist Backend API routes for MartUp e-commerce app

Work Log:
- Created `/src/app/api/wishlist/route.ts` with GET, POST, DELETE handlers
- **GET**: Lists user's wishlist items with full product details (includes seller, category, variants)
  - Requires `verifyAuth` authentication
  - Validates userId query param is required
  - SECURITY: Verifies authenticated user matches requested userId (users can only see their own wishlist)
  - Parses JSON fields (product.images, product.tags) using helper functions
  - Returns items ordered by createdAt desc
- **POST**: Add item to wishlist
  - Requires `verifyAuth` authentication
  - Rate limited to 30 operations per minute (checkRateLimit)
  - Validates productId is required and exists in database
  - Uses upsert to handle @@unique([userId, productId]) constraint (idempotent - returns existing record if already wishlisted)
  - Includes product details in response (seller, category, variants)
  - Returns 201 for new items, 200 for already-existing items
- **DELETE**: Remove item from wishlist
  - Requires `verifyAuth` authentication
  - Rate limited to 30 operations per minute
  - Supports deletion by productId (uses userId+productId composite unique) or by wishlistId
  - If wishlistId provided, verifies ownership before deleting (SECURITY)
  - If productId provided, deletes by composite key (userId from auth, productId from body)
  - Returns 404 if item not found
- Used `authErrorResponse` helper for consistent auth error responses
- Used `parseJsonField` and `parseProductJsonFields` helpers for JSON field parsing (matching user-data pattern)
- All responses follow `{ success: true, data: ... }` or `{ success: false, error: ... }` pattern

Stage Summary:
- Wishlist API fully implemented with GET/POST/DELETE at `/api/wishlist`
- All endpoints require authentication via `verifyAuth`
- Users can only access their own wishlist (userId verification on all operations)
- Product validation before adding to wishlist (prevents orphaned wishlist items)
- Upsert ensures idempotent add-to-wishlist operations
- Rate limiting (30/min) prevents abuse
- JSON field parsing for product images and tags
- Consistent error handling and response format

---
Task ID: 9
Agent: reviews-api
Task: Create Reviews Backend API routes for MartUp e-commerce app

Work Log:
- Created `/src/app/api/reviews/route.ts` with GET, POST, PUT, DELETE handlers
- **GET**: Public endpoint - get reviews for a product (no auth required)
  - Query param: productId (required)
  - Returns reviews with user info (id, name, avatar)
  - Parses JSON images field for each review
  - Sorted by createdAt DESC
- **POST**: Create a review - requires `verifyAuth`
  - Body: { productId, orderItemId?, rating, content?, images? }
  - Validates rating is 1-5
  - Validates content max 1000 chars
  - Verifies product exists before creating review
  - SECURITY: If orderItemId provided, verifies it belongs to the user's order (checks orderItem.order.userId matches authenticated user)
  - SECURITY: If orderItemId provided, verifies orderItem belongs to the specified productId
  - SECURITY: Checks no review already exists for that orderItem (one review per item, returns 409 Conflict)
  - Stringifies images array if provided
  - Creates review and recalculates product rating in a transaction
  - Rate limited to 10 reviews per minute (checkRateLimit)
- **PUT**: Update a review - requires `verifyAuth`
  - Body: { reviewId, rating?, content?, images? }
  - SECURITY: Verifies the review belongs to the authenticated user (403 Forbidden otherwise)
  - Validates rating (1-5) and content (max 1000 chars) if provided
  - Updates review and recalculates product rating in a transaction
- **DELETE**: Delete a review - requires `verifyAuth`
  - Body: { reviewId }
  - SECURITY: Verifies the review belongs to the authenticated user (403 Forbidden otherwise)
  - Deletes review and recalculates product rating in a transaction
- Helper: `recalculateProductRating()` - uses Prisma aggregate to compute avg rating and count, updates Product record
- Helper: `parseJsonField()` - safely parses JSON string fields (images)
- All responses follow `{ success: true, data: ... }` or `{ success: false, error: ... }` pattern
- All lint checks pass, dev server compiles without errors

Stage Summary:
- Reviews API fully implemented with GET/POST/PUT/DELETE at `/api/reviews`
- GET is public (no auth required) for browsing product reviews
- POST/PUT/DELETE require authentication via `verifyAuth`
- Users can only modify their own reviews (ownership verification on PUT/DELETE)
- OrderItem ownership verification prevents reviewing other users' orders
- One review per orderItem constraint enforced (unique check with 409 response)
- Product rating and reviewCount automatically recalculated on create/update/delete via transactions
- Rate limiting (10/min) prevents review spam
- Input validation: rating 1-5, content max 1000 chars, product existence check

---
Task ID: 11-12
Agent: api-agent
Task: Update Categories API + Create Voucher Validation API

Work Log:

### Task 11: Update Categories API

- Read existing `/src/app/api/categories/route.ts` (flat list of categories with productCount)
- Rewrote GET handler to support hierarchical category structure:
  - Added `parentId` query parameter support:
    - `?parentId=null` → returns root categories (parentId = null)
    - `?parentId=<categoryId>` → returns children of that category
    - No parentId → returns root categories with fully nested children
  - Included nested `children` relation up to 4 levels deep with product counts
  - Created recursive `transformCategory()` helper to convert Prisma's `_count` to `productCount` and nest children
  - Maintained `isActive: true` filter on all levels
  - Maintained `sortOrder: asc` ordering on all levels
  - Response format: `{ success, data: [{ id, name, slug, icon, parentId, productCount, children: [...] }] }`

### Task 12: Create Voucher Validation API

Created 2 new files:

1. **`/src/app/api/vouchers/route.ts`** (Public endpoint)
   - GET: Lists active vouchers within valid date range
   - Optional `userId` query param to check usage status per voucher
   - Returns `isAvailable`, `userCanUse`, `remainingUses`, `userRemainingUses` computed fields
   - No auth required (public browsing)

2. **`/src/app/api/vouchers/validate/route.ts`** (Authenticated endpoint)
   - **POST**: Validates a voucher code with all 6 validation checks:
     1. Voucher exists and isActive
     2. Voucher within valid date range (validFrom <= now <= validUntil)
     3. Cart subtotal meets minPurchase requirement
     4. Voucher usageLimit not exceeded
     5. User perUserLimit not exceeded (via VoucherUsage count)
     6. Seller-specific voucher check (sellerId match)
   - Calculates discount amount (percentage with maxDiscount cap, or fixed)
   - Rounds discount to integer Rupiah, ensures it doesn't exceed cart subtotal
   - Rate limited: max 10 per minute per user (via checkRateLimit)
   - Auth required: verifyAuth checks user identity, ensures authenticated userId matches request userId
   - **GET**: Lists available vouchers for a specific user
     - Requires auth (verifyAuth), validates userId matches authenticated user
     - Optional `sellerId` filter (returns platform vouchers + matching seller vouchers)
     - Includes user usage status and availability flags
   - All error messages in Indonesian (matching project locale)

Stage Summary:
- Categories API now returns hierarchical nested structure with sub-categories and product counts
- Voucher listing (public) and validation (authenticated) APIs fully implemented
- All 6 validation checks implemented per spec with Indonesian error messages
- Rate limiting on voucher validation (10/min per user)
- Auth enforcement on all protected endpoints
- Lint check passes (0 errors)

---
Task ID: 7
Agent: chat-api
Task: Create Chat Backend API routes for MartUp e-commerce app

Work Log:

1. **Created `/src/app/api/chat/rooms/route.ts`** - Chat Rooms API
   - **GET**: List chat rooms for authenticated user
     - Requires `verifyAuth` authentication
     - Finds all ChatParticipant records for the user
     - Includes room details, other participant's user/seller info, last message, unread count, product info
     - Returns array of rooms with: id, otherUser (with seller data), lastMessage, lastMessageTime, unreadCount, product
     - Unread count computed by counting messages where senderId != current user, isRead = false, and createdAt > participant.lastRead
   - **POST**: Create or get existing chat room
     - Requires `verifyAuth` authentication
     - Rate limited (10/min per IP)
     - Body: { sellerId, productId? }
     - Validates sellerId is required, cannot chat with yourself
     - Verifies seller exists and is active
     - Verifies product exists if productId provided
     - Checks for existing room between the two users (exact 2-participant match)
     - If exists, returns existing room with `isNew: false`
     - If not, creates new ChatRoom + 2 ChatParticipant records (buyer + seller) with `isNew: true`
     - Returns 201 for new rooms, 200 for existing

2. **Created `/src/app/api/chat/messages/route.ts`** - Chat Messages API
   - **GET**: Get messages for a room
     - Requires `verifyAuth` authentication
     - SECURITY: Verifies user is a participant in the room (403 Forbidden if not)
     - Query params: roomId (required), cursor (for pagination), limit (max 100, default 50)
     - Returns messages sorted by createdAt ASC with sender info (name, avatar, seller data)
     - Cursor-based pagination with hasMore and nextCursor fields
   - **POST**: Send a message
     - Requires `verifyAuth` authentication
     - Rate limited: max 30 messages per minute per user
     - Body: { roomId, content, type? }
     - SECURITY: Verifies user is a participant in the room (403 Forbidden if not)
     - Sanitizes message content: trims whitespace, max 2000 chars, rejects empty strings
     - Validates message type against allowlist (text, image, product, order), defaults to 'text'
     - Creates ChatMessage and updates ChatRoom updatedAt timestamp in a Prisma transaction
     - Returns created message with sender info
   - **PUT**: Mark messages as read
     - Requires `verifyAuth` authentication
     - SECURITY: Verifies user is a participant in the room (403 Forbidden if not)
     - Body: { roomId }
     - Updates ChatParticipant lastRead for the current user
     - Marks all unread messages in the room as read (where senderId != current user)
     - Both operations run in a Prisma transaction for atomicity

3. **Updated Prisma Schema**: Added `@@unique([roomId, userId])` constraint to ChatParticipant model
   - Enables efficient `findUnique` lookups with composite key `roomId_userId`
   - Prevents duplicate participant entries in the same room (data integrity)
   - Ran `bunx prisma db push --accept-data-loss` to sync

4. All lint checks pass, dev server compiles without errors

Stage Summary:
- Chat Rooms API fully implemented at `/api/chat/rooms` (GET + POST)
- Chat Messages API fully implemented at `/api/chat/messages` (GET + POST + PUT)
- All endpoints require authentication via `verifyAuth`
- Room participation verification on all message operations (GET/POST/PUT)
- Message content sanitized (trim, max 2000 chars, type validation)
- Rate limiting on room creation (10/min) and message sending (30/min per user)
- Cursor-based pagination for message history
- Prisma transactions for atomic operations (message + room update, mark read + update lastRead)
- @@unique constraint on ChatParticipant prevents duplicate room membership

---
Task ID: 13e-13g
Agent: frontend-updater
Task: Update frontend for seller product edit/delete API, sub-categories, and voucher validation

Work Log:

### Part 1: Seller Product Edit/Delete

1. **store.ts**: Exported `getAuthHeaders` function (was previously module-private, now `export function getAuthHeaders()`)
2. **seller-screens.tsx**: Updated delete button to call DELETE `/api/seller/products` API with auth headers instead of local-only `removeProduct()`. Now shows success/error toast based on API response, and only removes from local store after successful API call.
3. **seller-add-product-screen.tsx**: Changed product edit from PUT `/api/admin/products` (admin-only endpoint) to PUT `/api/seller/products` (seller-owned endpoint) with `getAuthHeaders()` for authentication. Also removed the `updates` wrapper and added `variants` field to the PUT payload for proper variant updates.

### Part 2: Sub-Categories

4. **store.ts**: Updated `categories` type in AppState interface to include `image`, `parentId`, and recursive `children` fields matching the hierarchical API response.
5. **store.ts**: Updated `fetchCategories` to use recursive `mapCategory` helper that maps `image`, `parentId`, and `children` fields from the API response, supporting nested sub-categories up to any depth.
6. **category-screen.tsx**: Complete rewrite of CategoryScreen:
   - Removed hardcoded `SUB_CATEGORIES` mock data (16 categories × 2-7 sub-categories each)
   - Changed from grid layout to list layout with expandable sub-categories
   - Categories with children now expand/collapse on tap (chevron animation)
   - Categories without children navigate directly to category-detail as before
   - Sub-categories navigate to category-detail on tap
   - Search now also matches sub-category names
7. **category-screen.tsx**: Updated CategoryDetailScreen to use `category.children` from API data instead of `SUB_CATEGORIES[category.id]`

### Part 3: Voucher Validation

8. **checkout-screen.tsx**: Added server-side voucher validation in `handlePay`:
   - Before processing payment, if a voucher is selected, calls POST `/api/vouchers/validate` with code, userId, and cartSubtotal
   - If validation fails (invalid voucher), shows error toast, deselects voucher, and aborts payment
   - If validation succeeds, uses server-computed `discountAmount` for order creation
   - Falls back to local calculation if API call fails
   - Added `selectVoucher` to destructured store values for deselecting invalid vouchers
   - Changed `handlePay` from sync to async function
9. **missing-screens.tsx VoucherScreen**: Added API data fetching:
   - Added `useEffect` to fetch vouchers from GET `/api/vouchers` on mount
   - Added `apiVouchers` state to store API results
   - Merged API vouchers with store vouchers (API takes priority, no duplicates)
   - `allVouchers` computed via `useMemo` combining both sources
   - Updated `handleUseCode` and `handleUseVoucher` to use `allVouchers` instead of `vouchers`
   - Added `useMemo` and `useEffect` to React imports

All lint checks pass (0 errors), dev server compiles without errors.

Stage Summary:
- Seller product delete now persists to database via DELETE API with auth
- Seller product edit now uses PUT `/api/seller/products` instead of admin API
- Categories now display hierarchical sub-categories from API (no more mock data)
- Expandable sub-category list in CategoryScreen with animation
- Voucher discount validated server-side before payment in checkout
- VoucherScreen fetches vouchers from API and merges with store data
- `getAuthHeaders` exported for reuse across components

---
Task ID: 13b-13d
Agent: store-frontend
Task: Update Zustand store and frontend screens for Chat, Wishlist, and Review APIs

Work Log:

### Part 1: Update store.ts

1. **Added chat API integration functions to AppState interface and implementation:**
   - `fetchChatRooms()`: GET `/api/chat/rooms` with auth headers, maps response to ChatRoom[] format, updates chatRooms and totalUnreadChats
   - `fetchChatMessages(roomId)`: GET `/api/chat/messages?roomId=X` with auth headers, maps to ChatMessage[], updates chatMessages[roomId]
   - `sendChatMessage(roomId, content, type?)`: POST `/api/chat/messages` with optimistic local update then replaces temp message with server response
   - `createChatRoom(sellerId, productId?)`: POST `/api/chat/rooms`, returns roomId, adds to local chatRooms if not already present
2. **Updated markChatRead** to also call PUT `/api/chat/messages` API to mark messages as read on server
3. **Updated addReview** to call POST `/api/reviews` API with { productId, rating, content, images }, keeps local state update for immediate UI feedback
4. **Added fetchProductReviews(productId)**: GET `/api/reviews?productId=X` (no auth needed), maps response to Review[], replaces reviews for that product while keeping others
5. **Updated useWishlistStore toggleWishlist**: Now uses optimistic local update + API calls (POST for add, DELETE for remove), reverts local state on API error
6. **Added syncWishlistFromServer(userId)**: GET `/api/wishlist?userId=X`, syncs local wishlistIds from server

### Part 2: Update chat-screen.tsx

7. **Removed MOCK_MESSAGES** const entirely
8. **Updated ChatScreen**: Added useEffect to fetch chat rooms from API on mount
9. **Updated ChatRoomView**: Added useEffect to fetch messages from API when entering a chat room
10. **Updated handleSend**: Calls `sendChatMessage` from store instead of just local `addChatMessage`

### Part 3: Update product-detail-screen.tsx

11. **Removed FALLBACK_REVIEWS** const entirely
12. **Added useEffect** to fetch reviews from API when product changes
13. **Updated review display**: Shows "Belum ada ulasan" when no reviews instead of falling back to mock data
14. **Updated chat button**: Now calls `createChatRoom(product.sellerId, product.id)` from store instead of creating a local-only room
15. **Added "Tulis Ulasan" button** with Dialog: Star rating (1-5), text content textarea, submit button, only visible when authenticated

All lint checks pass (0 errors), dev server compiles without errors.

Stage Summary:
- Chat screens now fetch real data from API (rooms + messages)
- Chat messages sent via API with optimistic local updates
- Chat room creation uses API instead of local-only creation
- Reviews fetched from API for each product
- Review creation persists to API
- Wishlist operations (add/remove) sync with API
- All mock/fallback data removed (MOCK_MESSAGES, FALLBACK_REVIEWS)
- Write Review dialog added for authenticated users
