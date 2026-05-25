# Task 2f: WebSocket Chat Mini Service

## Summary
Created the WebSocket Chat mini service at `/home/z/my-project/mini-services/chat-service/` for real-time messaging in the MartUp e-commerce app.

## Files Created

### `/home/z/my-project/mini-services/chat-service/package.json`
- Dependencies: socket.io (^4.7.0), @prisma/client (^6.0.0)
- DevDependencies: prisma (^6.0.0)
- Scripts: `dev` (bun --hot index.ts), `start` (bun index.ts)

### `/home/z/my-project/mini-services/chat-service/index.ts`
Main WebSocket server with Socket.IO:
- **Port**: 3004 (hardcoded)
- **Path**: '/' (Caddy gateway compatibility)
- **CORS**: origin '*' for gateway
- **Authentication**: HMAC token verification (same method as main app's auth-middleware.ts)
- **Events**: auth, join-room, leave-room, send-message, typing, mark-read, ping
- **DB**: Direct Prisma access to Supabase PostgreSQL
- **Security**: XSS sanitization, rate limiting, participant verification
- **Reliability**: Stale connection cleanup, heartbeat, graceful shutdown

### `/home/z/my-project/mini-services/chat-service/prisma/schema.prisma`
Copy of main project's Prisma schema with DATABASE_URL env var (instead of SUPABASE_DATABASE_URL)

## Frontend Connection
```typescript
import { io } from 'socket.io-client'

const socket = io('/?XTransformPort=3004', {
  transports: ['websocket', 'polling'],
  reconnection: true,
})

// Authenticate
socket.emit('auth', { token: hmacToken })

// Listen for events
socket.on('auth-success', (data) => { /* data: { userId, name, avatar, rooms } */ })
socket.on('new-message', (msg) => { /* msg: { id, roomId, senderId, content, type, isRead, createdAt, sender } */ })
socket.on('user-typing', (data) => { /* data: { roomId, userId, isTyping } */ })
socket.on('messages-read', (data) => { /* data: { roomId, userId, readAt } */ })

// Send message
socket.emit('send-message', { roomId, content, type: 'text' })

// Typing indicator
socket.emit('typing', { roomId, isTyping: true })

// Mark as read
socket.emit('mark-read', { roomId })
```

## Token Generation
The chat service uses the same HMAC token as the main app's `generateAuthToken()`:
```
base64(userId:timestamp:hmac-sha256-signature)
```

## Starting the Service
```bash
cd /home/z/my-project/mini-services/chat-service
DATABASE_URL="postgresql://..." TOKEN_SECRET="martup-hmac-token-secret-2024-x9k3m7p2q8" bun run dev
```
