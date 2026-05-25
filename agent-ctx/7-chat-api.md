# Task 7: Chat Backend API Routes

## Agent: chat-api

## Work Completed

### Files Created
1. `/src/app/api/chat/rooms/route.ts` - Chat Rooms API (GET + POST)
2. `/src/app/api/chat/messages/route.ts` - Chat Messages API (GET + POST + PUT)

### Files Modified
1. `/prisma/schema.prisma` - Added `@@unique([roomId, userId])` constraint to ChatParticipant model

### API Endpoints

#### GET /api/chat/rooms
- Lists all chat rooms for authenticated user
- Returns: id, otherUser (with seller data), lastMessage, lastMessageTime, unreadCount, product

#### POST /api/chat/rooms
- Creates new or returns existing chat room
- Body: { sellerId, productId? }
- Rate limited: 10/min per IP
- Returns: room data with isNew flag

#### GET /api/chat/messages
- Gets messages for a room with cursor-based pagination
- Query: roomId, cursor, limit
- SECURITY: Verifies room participation
- Returns: messages with sender info + pagination metadata

#### POST /api/chat/messages
- Sends a message
- Body: { roomId, content, type? }
- Rate limited: 30/min per user
- SECURITY: Verifies room participation
- Sanitizes: trim, max 2000 chars, type validation
- Uses transaction for message + room update

#### PUT /api/chat/messages
- Marks messages as read
- Body: { roomId }
- SECURITY: Verifies room participation
- Uses transaction for lastRead update + bulk isRead update

### Security Features
- All endpoints require verifyAuth
- Room participation check on all message operations
- Message content sanitization (trim, length, type)
- Rate limiting on room creation and message sending
- Cannot create chat room with yourself
- Seller existence/active verification

### Lint Status: PASS
### Dev Server: Compiles without errors
