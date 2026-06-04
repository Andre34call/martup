# Task 13b-13d: Update Zustand store and frontend screens for Chat, Wishlist, and Review APIs

## Work Log

### Part 1: Update store.ts

1. **Added chat API integration functions to AppState interface:**
   - `fetchChatRooms: () => Promise<void>` - GET `/api/chat/rooms` with auth headers, maps response to ChatRoom[] format, updates chatRooms and totalUnreadChats
   - `fetchChatMessages: (roomId: string) => Promise<void>` - GET `/api/chat/messages?roomId=X` with auth headers, maps to ChatMessage[], updates chatMessages[roomId]
   - `sendChatMessage: (roomId: string, content: string, type?: string) => Promise<void>` - POST `/api/chat/messages` with { roomId, content, type }, uses optimistic local update then replaces temp message with server response
   - `createChatRoom: (sellerId: string, productId?: string) => Promise<string | null>` - POST `/api/chat/rooms` with { sellerId, productId? }, returns roomId, adds to local chatRooms if not already present

2. **Updated markChatRead** to also call PUT `/api/chat/messages` API to mark messages as read on server

3. **Updated addReview** to call POST `/api/reviews` API with { productId, rating, content, images }, keeps local state update for immediate UI feedback

4. **Added fetchProductReviews** function:
   - GET `/api/reviews?productId=X` (no auth needed)
   - Maps response to Review[] with user info
   - Replaces reviews for that product in store while keeping reviews for other products

5. **Updated useWishlistStore:**
   - `toggleWishlist` now uses optimistic local update + API calls:
     - When adding: POST `/api/wishlist` with { productId } and auth headers
     - When removing: DELETE `/api/wishlist` with { productId } and auth headers
     - Reverts local state on API error
   - Added `syncWishlistFromServer(userId)` function:
     - GET `/api/wishlist?userId=X` with auth headers
     - Maps response product IDs and syncs local wishlistIds

### Part 2: Update chat-screen.tsx

1. **Removed MOCK_MESSAGES** const entirely (hardcoded chat messages for 3 rooms)
2. **Updated ChatScreen**: Added useEffect to fetch chat rooms from API on mount
3. **Updated ChatRoomView**: Added useEffect to fetch messages from API when entering a chat room
4. **Updated handleSend**: Calls `sendChatMessage` from store instead of just local `addChatMessage`
5. **Updated markChatRead**: Already calls API via updated store function

### Part 3: Update product-detail-screen.tsx

1. **Removed FALLBACK_REVIEWS** const entirely
2. **Added useEffect** to fetch reviews from API when product changes (fetchProductReviews)
3. **Updated review display**: Shows "Belum ada ulasan" when no reviews instead of falling back to mock data
4. **Updated chat button**: Now calls `createChatRoom(product.sellerId, product.id)` from store instead of creating a local-only room
5. **Added "Tulis Ulasan" button** in the reviews section (only visible when authenticated):
   - Opens a Dialog with star rating selector (1-5), text content textarea, submit button
   - On submit, calls `addReview()` via store (which calls the API)
   - Uses Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription from shadcn/ui
   - Uses Textarea from shadcn/ui
   - Has loading state and error handling

### Security:
- All authenticated API calls use `getAuthHeaders()` for Authorization Bearer token
- API errors handled gracefully with try/catch and fallback to local state
- Wishlist reverts local state on API error

## Stage Summary
- Chat screens now fetch real data from API (rooms + messages)
- Chat messages are sent via API with optimistic local updates
- Chat room creation uses API instead of local-only creation
- Reviews are fetched from API for each product
- Review creation persists to API
- Wishlist operations (add/remove) sync with API
- Wishlist can be synced from server via syncWishlistFromServer
- All mock/fallback data removed (MOCK_MESSAGES, FALLBACK_REVIEWS)
- Write Review dialog added for authenticated users
- Lint passes, dev server compiles without errors
