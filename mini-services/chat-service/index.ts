import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import crypto from 'crypto'
import pino from 'pino'

// ==================== LOGGER ====================

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  ...(process.env.NODE_ENV !== 'production' ? {
    transport: { target: 'pino-pretty', options: { colorize: true } }
  } : {}),
})

// ==================== CONFIGURATION ====================

const PORT = 3004

// SECURITY: TOKEN_SECRET must come from environment, no fallback
const TOKEN_SECRET = (() => {
  const secret = process.env.TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    logger.fatal('TOKEN_SECRET or NEXTAUTH_SECRET environment variable must be set. Chat service cannot start without it.')
    process.exit(1)
  }
  return secret
})()

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

// SECURITY: DATABASE_URL must come from environment — NO hardcoded credentials
if (!process.env.DATABASE_URL) {
  logger.fatal('DATABASE_URL environment variable must be set. Chat service cannot start without it.')
  process.exit(1)
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

// ==================== ALLOWED ORIGINS ====================

const ALLOWED_ORIGINS = (() => {
  const origins = (process.env.ALLOWED_ORIGINS || 'https://martup-seven.vercel.app')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  // Add localhost in development
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000')
  }

  return origins
})()

// ==================== SOCKET.IO SERVER ====================

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : ['https://martup-seven.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 10000,
})

// ==================== CONNECTION HANDLER ====================

io.on('connection', (socket: Socket) => {
  logger.info({ socketId: socket.id }, 'Socket connected')

  let isAuthenticated = false
  let userId: string | null = null

  // ---------- AUTH EVENT ----------
  socket.on('auth', async (data: { userId?: string; token?: string }) => {
    try {
      if (!data || !data.token) {
        logger.warn({ socketId: socket.id }, 'Auth failed: no token provided')
        socket.emit('auth-error', { message: 'Authentication token required' })
        socket.disconnect(true)
        return
      }

      // Verify HMAC token
      const verifiedUserId = verifyAuthToken(data.token)
      if (!verifiedUserId) {
        logger.warn({ socketId: socket.id }, 'Auth failed: invalid or expired token')
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
        logger.warn({ socketId: socket.id, userId: verifiedUserId }, 'Auth failed: user not found or inactive')
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

      logger.info(
        { socketId: socket.id, userId: verifiedUserId, userName: user.name, roomCount: participations.length },
        'User authenticated'
      )
    } catch (error) {
      logger.error({ error, socketId: socket.id }, 'Auth error')
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
      logger.info({ userId, roomId }, 'User joined room')
    } catch (error) {
      logger.error({ error, userId, socketId: socket.id }, 'Join room error')
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
    logger.info({ userId, roomId }, 'User left room')
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

      logger.info(
        { userId, roomId, messageType, contentLength: sanitizedContent.length },
        'Message sent'
      )
    } catch (error) {
      logger.error({ error, userId, socketId: socket.id, roomId: data.roomId }, 'Send message error')
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

      logger.info({ userId, roomId }, 'Messages marked as read')
    } catch (error) {
      logger.error({ error, userId, socketId: socket.id, roomId: data.roomId }, 'Mark read error')
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

          logger.info({ userId: disconnectedUserId }, 'User fully disconnected (no more sockets)')
        }
      }

      // Remove from connected users
      connectedUsers.delete(socket.id)

      logger.info(
        { socketId: socket.id, userId: disconnectedUserId, reason },
        'Socket disconnected'
      )
    } else {
      logger.info({ socketId: socket.id, reason }, 'Unauthenticated socket disconnected')
    }
  })

  // ---------- ERROR EVENT ----------
  socket.on('error', (error) => {
    logger.error({ error, socketId: socket.id }, 'Socket error')
  })

  // Auto-disconnect if not authenticated within 10 seconds
  setTimeout(() => {
    if (!isAuthenticated && socket.connected) {
      logger.warn({ socketId: socket.id }, 'Disconnecting unauthenticated socket (auth timeout)')
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
        logger.warn({ socketId, userId: userInfo.userId }, 'Disconnecting stale connection')
        socket.emit('error', { message: 'Connection timed out due to inactivity' })
        socket.disconnect(true)
      }
    }
  }
}, STALE_CHECK_INTERVAL)

// ==================== PERIODIC CONNECTION STATS ====================

setInterval(() => {
  const totalSockets = connectedUsers.size
  const totalUsers = userSockets.size
  const activeRooms = new Set<string>()
  for (const userInfo of connectedUsers.values()) {
    for (const roomId of userInfo.rooms) {
      activeRooms.add(roomId)
    }
  }
  const totalTypingRooms = typingUsers.size

  logger.info(
    {
      totalSockets,
      totalUsers,
      activeRooms: activeRooms.size,
      typingRooms: totalTypingRooms,
      rateLimitEntries: rateLimitMap.size,
    },
    'Connection statistics'
  )
}, 5 * 60 * 1000) // every 5 minutes

// ==================== SERVER START ====================

httpServer.listen(PORT, () => {
  logger.info({ port: PORT, path: '/', auth: 'HMAC', db: 'Prisma (env-based)' }, 'MartUp Chat WebSocket server started')
  logger.info({ origins: ALLOWED_ORIGINS }, 'CORS allowed origins')
})

// ==================== GRACEFUL SHUTDOWN ====================

async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Shutting down...')

  // Close all socket connections
  io.disconnectSockets(true)

  // Close HTTP server
  httpServer.close(() => {
    logger.info('HTTP server closed')
  })

  // Disconnect Prisma
  try {
    await prisma.$disconnect()
    logger.info('Prisma disconnected')
  } catch (err) {
    logger.error({ error: err }, 'Prisma disconnect error')
  }

  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
