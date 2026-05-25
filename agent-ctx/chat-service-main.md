# Chat Service Mini-Service - Work Record

## Task ID: chat-service

## Summary
Created a WebSocket mini-service for real-time chat in the MartUp e-commerce app using Socket.io.

## Files Created
1. `/home/z/my-project/mini-services/chat-service/package.json` - Independent Bun project with dependencies
2. `/home/z/my-project/mini-services/chat-service/prisma/schema.prisma` - Prisma schema pointing to the same SQLite DB
3. `/home/z/my-project/mini-services/chat-service/index.ts` - Socket.io server with all event handlers

## Dependencies Installed
- `@prisma/client@6.19.3` - Prisma client for database access
- `socket.io@4.8.3` - WebSocket server
- `prisma@6.19.3` - Prisma CLI for client generation
- `bun-types@1.3.4` - Bun type definitions

## Prisma Client Generated
Generated from the mini-service's own prisma schema which points to `/home/z/my-project/db/custom.db`.
Only includes models needed by the chat service: User, Seller, ChatRoom, ChatParticipant, ChatMessage.

## Socket.io Events Implemented

### Client → Server:
- `join-room`: `{ roomId }` - Join a chat room with DB validation
- `leave-room`: `{ roomId }` - Leave a chat room, cleans up typing state
- `send-message`: `{ roomId, senderId, content, type? }` - Send a message, saves to DB, broadcasts, updates room updatedAt, triggers auto-reply
- `typing`: `{ roomId, userId }` - User is typing indicator
- `stop-typing`: `{ roomId, userId }` - User stopped typing
- `mark-read`: `{ roomId, userId }` - Mark messages as read, updates DB

### Server → Client:
- `new-message`: `{ id, roomId, senderId, content, type, createdAt }` - New message broadcast
- `user-typing`: `{ roomId, userId }` - Typing indicator broadcast
- `user-stop-typing`: `{ roomId, userId }` - Stop typing broadcast
- `messages-read`: `{ roomId, userId }` - Read receipt broadcast

## Key Features
- **Auto-reply**: When a seller has `autoReply` configured, the service automatically sends the auto-reply after a 1-2 second random delay
- **DB Persistence**: All messages are saved to the same SQLite database as the main app
- **Room-based messaging**: Uses socket.io rooms for efficient message broadcasting
- **Typing indicators**: Tracks typing state per room and broadcasts to other participants
- **Read receipts**: Marks messages as read and updates participant's lastRead timestamp
- **Graceful shutdown**: Properly closes connections and disconnects Prisma on SIGTERM/SIGINT
- **Error handling**: Validates inputs, checks room existence, verifies participant membership

## Port & Connection
- Port: 3003 (hardcoded)
- Socket.io path: `/`
- Frontend connection: `io('/?XTransformPort=3003')`

## Verification
- Service starts successfully and listens on port 3003
- Socket.io polling endpoint responds correctly
- Dev script: `bun --hot index.ts` (auto-restarts on file changes)
