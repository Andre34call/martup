import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import crypto from 'crypto'

// ==================== CONFIGURATION ====================

const PORT = 3004
<<<<<<< HEAD

// SECURITY: TOKEN_SECRET must come from environment, no fallback
const TOKEN_SECRET = (() => {
  const secret = process.env.TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    console.error('[FATAL] TOKEN_SECRET or NEXTAUTH_SECRET environment variable must be set. Chat service cannot start without it.')
    process.exit(1)
  }
  return secret
})()

=======
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'martup-hmac-token-secret-2024-x9k3m7p2q8'
>>>>>>> e8fde0be16ee13d9b5683813059064bdd2e4c629
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours
const MAX_MESSAGE_LENGTH = 2000
const VALID_MESSAGE_TYPES = ['text', 'image', 'product', 'order']

// Rate limiting: max messages per minute per user
const MESSAGE_RATE_LIMIT = 30
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute

// Stale connection cleanup interval
const STALE_CHECK_INTERVAL = 60 * 1000 // 1 minute
const STALE_TIMEOUT = 5 * 60 * 1000 // 5 minutes of no activity = stale

// ==================== PRISMA CLIENT ====================

<<<<<<< HEAD
// SECURITY: DATABASE_URL must come from environment — NO hardcoded credentials
if (!process.env.DATABASE_URL) {
  console.error('[FATAL] DATABASE_URL environment variable must be set. Chat service cannot start without it.')
  process.exit(1)
=======
// Set DATABASE_URL before importing PrismaClient
// The chat service uses the same Supabase PostgreSQL database as the main app
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres.rzrfouzuxcxdbhadbppi:Wordpress3%24supabase@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
>>>>>>> e8fde0be16ee13d9b5683813059064bdd2e4c629
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// ==================== IN-MEMORY STATE ====================

interface AuthenticatedUser {
  userId: string
  connectedAt: number
  lastActivity: number
  rooms: Set<string>
}

// Socket ID -> User info
const connectedUsers = new Map<string, AuthenticatedUser>()

// User ID -> Set of Socket IDs (a user can have multiple connections)
const userSockets = new Map<string, Set<string>>()

// Rate limiting: userId -> { count, lastReset }
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()

// Typing state: roomId -> Set of userIds currently typing
const typingUsers = new Map<string, Set<string>>()

// ==================== HMAC TOKEN VERIFICATION ====================

/**
 * Verify an HMAC-signed auth token.
 * Format: base64(userId:timestamp:hmacSignature)
 * Returns the userId if valid, null otherwise.
 */
function verifyAuthToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const [userId, timestamp, signature] = decoded.split(':')

    if (!userId || !timestamp || !signature) return null

    // Check token expiry
    const tokenAge = Date.now() - parseInt(timestamp)
    if (tokenAge <= 0 || tokenAge > TOKEN_EXPIRY) return null

    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(`${userId}:${timestamp}`)
      .digest('hex')

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return null
    }

    return userId
  } catch {
    return null
  }
}

// ==================== RATE LIMITING ====================

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now - entry.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(userId, { count: 1, lastReset: now })
    return true
  }

  if (entry.count >= MESSAGE_RATE_LIMIT) {
    return false
  }

  entry.count++
  return true
}

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.lastReset > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(key)
    }
  }
}, 5 * 60 * 1000)

// ==================== XSS SANITIZATION ====================

/**
 * Strip HTML tags from content to prevent XSS attacks.
 * Simple implementation that doesn't require external dependencies.
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Strip all HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim()
}

<<<<<<< HEAD
// ==================== ALLOWED ORIGINS ====================

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  'https://martup-seven.vercel.app',
  'http://localhost:3000',
].filter(Boolean) as string[]

=======
>>>>>>> e8fde0be16ee13d9b5683813059064bdd2e4c629
// ==================== SOCKET.IO SERVER ====================

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
<<<<<<< HEAD
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : ['https://martup-seven.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true,
=======
    origin: '*',
    methods: ['GET', 'POST'],
>>>>>>> e8fde0be16ee13d9b5683813059064bdd2e4c629
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 10000,
})

// ==================== CONNECTION HANDLER ====================

io.on('connection', (socket: Socket) => {
  console.log(`[ChatService] Socket connected: ${socket.id}`)

  let isAuthenticated = false
  let userId: string | null = null

  // ---------- AUTH EVENT ----------
  socket.on('auth', async (data: { userId?: string; token?: string }) => {
    try {
      if (!data || !data.token) {
        console.warn(`[ChatService] Auth failed for socket ${socket.id}: no token provided`)
        socket.emit('auth-error', { message: 'Authentication token required' })
        socket.disconnect(true)
        return
      }

      // Verify HMAC token
      const verifiedUserId = verifyAuthToken(data.token)
      if (!verifiedUserId) {
        console.warn(`[ChatService] Auth failed for socket ${socket.id}: invalid token`)
        socket.emit('auth-error', { message: 'Invalid or expired authentication token' })
        socket.disconnect(true)
        return
      }

      // Verify user exists and is active in database
      const user = await prisma.user.findUnique({
        where: { id: verifiedUserId },
        select: {
          id: true,
          name: true,
          avatar: true,
          isActive: true,
          seller: {
            select: {
              id: true,
              storeName: true,
              storeAvatar: true,
              isVerified: true,
            },
          },
        },
      })

      if (!user || !user.isActive) {
        console.warn(`[ChatService] Auth failed for socket ${socket.id}: user not found or inactive`)
        socket.emit('auth-error', { message: 'User not found or inactive' })
        socket.disconnect(true)
        return
      }

      // Mark as authenticated
      isAuthenticated = true
      userId = verifiedUserId

      // Store connection info
      const now = Date.now()
      connectedUsers.set(socket.id, {
        userId: verifiedUserId,
        connectedAt: now,
        lastActivity: now,
        rooms: new Set(),
      })

      // Track user -> sockets mapping
      if (!userSockets.has(verifiedUserId)) {
        userSockets.set(verifiedUserId, new Set())
      }
      userSockets.get(verifiedUserId)!.add(socket.id)

      // Join all rooms the user is a participant in
      const participations = await prisma.chatParticipant.findMany({
        where: { userId: verifiedUserId },
        select: { roomId: true },
      })

      for (const p of participations) {
        socket.join(p.roomId)
        connectedUsers.get(socket.id)?.rooms.add(p.roomId)
      }

      // Send auth success with user info
      socket.emit('auth-success', {
        userId: verifiedUserId,
        name: user.name,
        avatar: user.avatar,
        rooms: participations.map((p) => p.roomId),
      })

      console.log(
        `[ChatService] User ${user.name} (${verifiedUserId}) authenticated on socket ${socket.id}, joined ${participations.length} rooms`
      )
    } catch (error) {
      console.error('[ChatService] Auth error:', error)
      socket.emit('auth-error', { message: 'Authentication failed' })
      socket.disconnect(true)
    }
  })

  // ---------- JOIN ROOM EVENT ----------
  socket.on('join-room', async (data: { roomId: string }) => {
    if (!isAuthenticated || !userId) {
      socket.emit('error', { message: 'Not authenticated' })
      return
    }

    try {
      const { roomId } = data
      if (!roomId) {
        socket.emit('error', { message: 'roomId is required' })
        return
      }

      // Verify user is a participant in this room
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: userId!,
          },
        },
      })

      if (!participant) {
        socket.emit('error', { message: 'Forbidden - You are not a participant in this room' })
        return
      }

      socket.join(roomId)
      connectedUsers.get(socket.id)?.rooms.add(roomId)

      // Update last activity
      const userInfo = connectedUsers.get(socket.id)
      if (userInfo) userInfo.lastActivity = Date.now()

      socket.emit('room-joined', { roomId })
      console.log(`[ChatService] User ${userId} joined room ${roomId}`)
    } catch (error) {
      console.error('[ChatService] Join room error:', error)
      socket.emit('error', { message: 'Failed to join room' })
    }
  })

  // ---------- LEAVE ROOM EVENT ----------
  socket.on('leave-room', (data: { roomId: string }) => {
    if (!isAuthenticated || !userId) {
      socket.emit('error', { message: 'Not authenticated' })
      return
    }

    const { roomId } = data
    if (!roomId) {
      socket.emit('error', { message: 'roomId is required' })
      return
    }

    socket.leave(roomId)
    connectedUsers.get(socket.id)?.rooms.delete(roomId)

    // Remove from typing state
    const roomTyping = typingUsers.get(roomId)
    if (roomTyping) {
      roomTyping.delete(userId!)
      if (roomTyping.size === 0) {
        typingUsers.delete(roomId)
      }
    }

    // Update last activity
    const userInfo = connectedUsers.get(socket.id)
    if (userInfo) userInfo.lastActivity = Date.now()

    socket.emit('room-left', { roomId })
    console.log(`[ChatService] User ${userId} left room ${roomId}`)
  })

  // ---------- SEND MESSAGE EVENT ----------
  socket.on('send-message', async (data: { roomId: string; content: string; type?: string }) => {
    if (!isAuthenticated || !userId) {
      socket.emit('error', { message: 'Not authenticated' })
      return
    }

    try {
      const { roomId, content, type } = data

      // Validate roomId
      if (!roomId) {
        socket.emit('error', { message: 'roomId is required' })
        return
      }

      // Validate content
      if (!content || typeof content !== 'string') {
        socket.emit('error', { message: 'content is required and must be a string' })
        return
      }

      // Rate limiting
      if (!checkRateLimit(userId!)) {
        socket.emit('error', { message: 'Too many messages. Please try again in a minute.' })
        return
      }

      // Sanitize content to prevent XSS
      const sanitizedContent = sanitizeInput(content)

      if (sanitizedContent.length === 0) {
        socket.emit('error', { message: 'Message content cannot be empty' })
        return
      }

      if (sanitizedContent.length > MAX_MESSAGE_LENGTH) {
        socket.emit('error', { message: `Message content exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` })
        return
      }

      // Validate message type
      const messageType = type && VALID_MESSAGE_TYPES.includes(type) ? type : 'text'

      // Verify user is a participant in this room
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: userId!,
          },
        },
      })

      if (!participant) {
        socket.emit('error', { message: 'Forbidden - You are not a participant in this room' })
        return
      }

      // Save message to DB and update room's updatedAt in a transaction
      const message = await prisma.$transaction(async (tx) => {
        const newMessage = await tx.chatMessage.create({
          data: {
            roomId,
            senderId: userId!,
            content: sanitizedContent,
            type: messageType,
          },
        })

        // Update room's updatedAt timestamp so room appears at top of list
        await tx.chatRoom.update({
          where: { id: roomId },
          data: { updatedAt: new Date() },
        })

        return newMessage
      })

      // Get sender info for the broadcast
      const sender = await prisma.user.findUnique({
        where: { id: userId! },
        select: {
          id: true,
          name: true,
          avatar: true,
          seller: {
            select: {
              id: true,
              storeName: true,
              storeAvatar: true,
            },
          },
        },
      })

      // Build message data for broadcast
      const messageData = {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        isRead: message.isRead,
        createdAt: message.createdAt.toISOString(),
        sender: sender
          ? {
              id: sender.id,
              name: sender.name,
              avatar: sender.avatar,
              seller: sender.seller,
            }
          : null,
      }

      // Broadcast to all sockets in the room (including sender for confirmation)
      io.to(roomId).emit('new-message', messageData)

      // Remove typing state for this user in this room
      const roomTyping = typingUsers.get(roomId)
      if (roomTyping) {
        roomTyping.delete(userId!)
        // Broadcast that user stopped typing
        socket.to(roomId).emit('user-typing', {
          roomId,
          userId: userId!,
          isTyping: false,
        })
      }

      // Update last activity
      const userInfo = connectedUsers.get(socket.id)
      if (userInfo) userInfo.lastActivity = Date.now()

      console.log(`[ChatService] Message from ${userId} in room ${roomId}: ${sanitizedContent.substring(0, 50)}...`)
    } catch (error) {
      console.error('[ChatService] Send message error:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  // ---------- TYPING EVENT ----------
  socket.on('typing', (data: { roomId: string; isTyping: boolean }) => {
    if (!isAuthenticated || !userId) {
      return // Silently ignore unauthenticated typing events
    }

    const { roomId, isTyping } = data
    if (!roomId) return

    // Verify user is still in this room
    const userInfo = connectedUsers.get(socket.id)
    if (!userInfo || !userInfo.rooms.has(roomId)) return

    // Track typing state
    if (!typingUsers.has(roomId)) {
      typingUsers.set(roomId, new Set())
    }

    const roomTyping = typingUsers.get(roomId)!
    if (isTyping) {
      roomTyping.add(userId!)
    } else {
      roomTyping.delete(userId!)
      if (roomTyping.size === 0) {
        typingUsers.delete(roomId)
      }
    }

    // Broadcast to others in the room (NOT to the sender)
    socket.to(roomId).emit('user-typing', {
      roomId,
      userId: userId!,
      isTyping,
    })

    // Update last activity
    if (userInfo) userInfo.lastActivity = Date.now()
  })

  // ---------- MARK READ EVENT ----------
  socket.on('mark-read', async (data: { roomId: string }) => {
    if (!isAuthenticated || !userId) {
      socket.emit('error', { message: 'Not authenticated' })
      return
    }

    try {
      const { roomId } = data
      if (!roomId) {
        socket.emit('error', { message: 'roomId is required' })
        return
      }

      // Verify user is a participant in this room
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId: userId!,
          },
        },
      })

      if (!participant) {
        socket.emit('error', { message: 'Forbidden - You are not a participant in this room' })
        return
      }

      // Update participant's lastRead and mark messages as read
      await prisma.$transaction(async (tx) => {
        // Update participant's lastRead timestamp
        await tx.chatParticipant.update({
          where: {
            roomId_userId: {
              roomId,
              userId: userId!,
            },
          },
          data: { lastRead: new Date() },
        })

        // Mark all unread messages in the room as read
        // where the sender is NOT the current user
        await tx.chatMessage.updateMany({
          where: {
            roomId,
            senderId: { not: userId! },
            isRead: false,
          },
          data: { isRead: true },
        })
      })

      // Broadcast to others in the room that messages were read
      socket.to(roomId).emit('messages-read', {
        roomId,
        userId: userId!,
        readAt: new Date().toISOString(),
      })

      // Confirm to the sender
      socket.emit('read-confirmed', { roomId })

      // Update last activity
      const userInfo = connectedUsers.get(socket.id)
      if (userInfo) userInfo.lastActivity = Date.now()

      console.log(`[ChatService] User ${userId} marked messages as read in room ${roomId}`)
    } catch (error) {
      console.error('[ChatService] Mark read error:', error)
      socket.emit('error', { message: 'Failed to mark messages as read' })
    }
  })

  // ---------- HEARTBEAT / PING EVENT ----------
  socket.on('ping', () => {
    if (!isAuthenticated) return

    const userInfo = connectedUsers.get(socket.id)
    if (userInfo) {
      userInfo.lastActivity = Date.now()
    }

    socket.emit('pong', { timestamp: Date.now() })
  })

  // ---------- DISCONNECT EVENT ----------
  socket.on('disconnect', (reason) => {
    const userInfo = connectedUsers.get(socket.id)

    if (userInfo) {
      const disconnectedUserId = userInfo.userId

      // Clean up user -> sockets mapping
      const sockets = userSockets.get(disconnectedUserId)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size === 0) {
          userSockets.delete(disconnectedUserId)

          // Remove typing state for this user in all rooms
          for (const roomId of userInfo.rooms) {
            const roomTyping = typingUsers.get(roomId)
            if (roomTyping) {
              roomTyping.delete(disconnectedUserId)
              if (roomTyping.size === 0) {
                typingUsers.delete(roomId)
              }
              // Notify room that user stopped typing
              io.to(roomId).emit('user-typing', {
                roomId,
                userId: disconnectedUserId,
                isTyping: false,
              })
            }
          }

          console.log(`[ChatService] User ${disconnectedUserId} fully disconnected (no more sockets)`)
        }
      }

      // Remove from connected users
      connectedUsers.delete(socket.id)

      console.log(
        `[ChatService] Socket ${socket.id} disconnected (user: ${disconnectedUserId}, reason: ${reason})`
      )
    } else {
      console.log(`[ChatService] Unauthenticated socket ${socket.id} disconnected (reason: ${reason})`)
    }
  })

  // ---------- ERROR EVENT ----------
  socket.on('error', (error) => {
    console.error(`[ChatService] Socket error (${socket.id}):`, error)
  })

  // Auto-disconnect if not authenticated within 10 seconds
  setTimeout(() => {
    if (!isAuthenticated && socket.connected) {
      console.warn(`[ChatService] Disconnecting unauthenticated socket ${socket.id}`)
      socket.emit('auth-error', { message: 'Authentication timeout' })
      socket.disconnect(true)
    }
  }, 10000)
})

// ==================== STALE CONNECTION CLEANUP ====================

setInterval(() => {
  const now = Date.now()
  for (const [socketId, userInfo] of connectedUsers.entries()) {
    if (now - userInfo.lastActivity > STALE_TIMEOUT) {
      const socket = io.sockets.sockets.get(socketId)
      if (socket) {
        console.warn(`[ChatService] Disconnecting stale connection: ${socketId} (user: ${userInfo.userId})`)
        socket.emit('error', { message: 'Connection timed out due to inactivity' })
        socket.disconnect(true)
      }
    }
  }
}, STALE_CHECK_INTERVAL)

// ==================== SERVER START ====================

httpServer.listen(PORT, () => {
  console.log(`[ChatService] MartUp Chat WebSocket server running on port ${PORT}`)
  console.log(`[ChatService] Path: / (for Caddy gateway compatibility)`)
  console.log(`[ChatService] Auth: HMAC token verification enabled`)
<<<<<<< HEAD
  console.log(`[ChatService] DB: Environment-based Prisma access (no hardcoded credentials)`)
  console.log(`[ChatService] CORS: Restricted to allowed origins only`)
=======
  console.log(`[ChatService] DB: Direct Prisma access`)
>>>>>>> e8fde0be16ee13d9b5683813059064bdd2e4c629
})

// ==================== GRACEFUL SHUTDOWN ====================

async function gracefulShutdown(signal: string) {
  console.log(`[ChatService] Received ${signal}, shutting down...`)

  // Close all socket connections
  io.disconnectSockets(true)

  // Close HTTP server
  httpServer.close(() => {
    console.log('[ChatService] HTTP server closed')
  })

  // Disconnect Prisma
  await prisma
    .$disconnect()
    .then(() => console.log('[ChatService] Prisma disconnected'))
    .catch((err) => console.error('[ChatService] Prisma disconnect error:', err))

  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
