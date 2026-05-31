import type { StateCreator } from 'zustand'
import { logger } from '@/lib/logger'
import type { ChatSlice, AppStore } from './types'
import type { ChatRoom, ChatMessage, Product } from '../types'
import { apiClient } from '@/lib/api-client'
import { io, Socket } from 'socket.io-client'
import { hasAuthFlagCookie } from '@/lib/session-cookie'
import type { ChatRoomsResponse, ChatMessagesResponse } from '@/lib/api-types'
import { mapChatProductPreview, mapChatSeller } from '@/lib/store-helpers'

// Module-level socket reference so it persists across zustand calls
let socket: Socket | null = null

// WebSocket URL for chat — configurable per environment.
// In sandbox: Caddy gateway proxies /?XTransformPort=3004 to chat mini-service.
// On Vercel:  set NEXT_PUBLIC_CHAT_WS_URL to your WebSocket service URL, or leave empty to disable WS.
const WS_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_CHAT_WS_URL || '')
  : ''

// Detect if WebSocket chat is available in this environment
const isWsAvailable = typeof window !== 'undefined' && WS_URL !== ''

export const createChatSlice: StateCreator<AppStore, [], [], ChatSlice> = (set, get) => ({
  chatRooms: [],
  chatMessages: {},
  totalUnreadChats: 0,
  isSocketConnected: false,
  typingUsers: {},

  addChatMessage: (roomId, message) => set((state) => ({
    chatMessages: {
      ...state.chatMessages,
      [roomId]: [...(state.chatMessages[roomId] || []), message],
    },
    chatRooms: state.chatRooms.map(r =>
      r.id === roomId
        ? { ...r, lastMessage: message.content, lastMessageTime: message.createdAt }
        : r
    ),
  })),

  addChatRoom: (room) => set((state) => ({
    chatRooms: [room, ...state.chatRooms],
  })),

  markChatRead: (roomId) => {
    // Send via WebSocket for real-time notification
    if (socket && get().isSocketConnected) {
      socket.emit('mark-read', { roomId })
    }

    // Also call REST API as fallback / for persistence
    apiClient.rawPut('/api/chat/messages', { roomId }).catch(() => {})

    return set((state) => {
      const roomMessages = state.chatMessages[roomId]
      if (!roomMessages) return state

      const updatedMessages = {
        ...state.chatMessages,
        [roomId]: roomMessages.map(m => ({ ...m, isRead: true })),
      }

      const updatedRooms = state.chatRooms.map(r =>
        r.id === roomId ? { ...r, unreadCount: 0 } : r
      )

      const totalUnreadChats = updatedRooms.reduce((sum, r) => sum + r.unreadCount, 0)

      return {
        chatMessages: updatedMessages,
        chatRooms: updatedRooms,
        totalUnreadChats,
      }
    })
  },

  fetchChatRooms: async () => {
    try {
      const data = await apiClient.get<ChatRoomsResponse>('/api/chat/rooms')
      if (data.success && data.data) {
        const rooms: ChatRoom[] = (data.data as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => {
          const otherUser = r.otherUser as Record<string, unknown> | undefined
          const productData = r.product as Record<string, unknown> | undefined
          return {
            id: r.id as string,
            seller: mapChatSeller(otherUser),
            lastMessage: (r.lastMessage as string) || '',
            lastMessageTime: (r.lastMessageTime as string) || (r.updatedAt as string) || new Date().toISOString(),
            unreadCount: (r.unreadCount as number) || 0,
            product: productData ? mapChatProductPreview(productData) as unknown as Product : undefined,
          }
        })
        const totalUnreadChats = rooms.reduce((sum, r) => sum + r.unreadCount, 0)
        set({ chatRooms: rooms, totalUnreadChats })

        // Join all chat rooms via WebSocket for real-time updates
        if (socket && get().isSocketConnected) {
          rooms.forEach(room => {
            socket!.emit('join-room', { roomId: room.id })
          })
        }
      }
    } catch (error) {
      logger.warn({ component: 'chat', err: error }, 'Fetch chat rooms error')
    }
  },

  fetchChatMessages: async (roomId) => {
    try {
      const data = await apiClient.get<ChatMessagesResponse>('/api/chat/messages', { roomId })
      if (data.success && data.data) {
        const messages: ChatMessage[] = (data.data as Array<Record<string, unknown>>).map((m: Record<string, unknown>) => ({
          id: m.id as string,
          roomId: m.roomId as string || roomId,
          senderId: m.senderId as string,
          content: m.content as string,
          type: (m.type as ChatMessage['type']) || 'text',
          isRead: m.isRead as boolean,
          createdAt: m.createdAt as string,
        }))
        set((state) => ({
          chatMessages: {
            ...state.chatMessages,
            [roomId]: messages,
          },
        }))
      }
    } catch (error) {
      logger.warn({ component: 'chat', err: error }, 'Fetch chat messages error')
    }
  },

  sendChatMessage: async (roomId, content, type = 'text') => {
    // Optimistic local update first
    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      roomId,
      senderId: get().currentUser?.id || '',
      content,
      type: type as ChatMessage['type'],
      isRead: false,
      createdAt: new Date().toISOString(),
    }
    get().addChatMessage(roomId, tempMsg)

    // Try WebSocket first for real-time delivery
    if (socket && get().isSocketConnected) {
      socket.emit('send-message', { roomId, content, type })
      // The server will broadcast the message back via 'new-message' event
      // which will replace the temp message in the handler
    }

    // REST API as fallback / for persistence
    try {
      const res = await apiClient.rawPost('/api/chat/messages', { roomId, content, type })
      if (!res.ok) throw new Error('Failed to send message')
      const data = await res.json()
      // Replace temp message with real one from server
      if (data.success && data.data) {
        const m = data.data as Record<string, unknown>
        const realMsg: ChatMessage = {
          id: m.id as string,
          roomId: m.roomId as string || roomId,
          senderId: m.senderId as string,
          content: m.content as string,
          type: (m.type as ChatMessage['type']) || 'text',
          isRead: m.isRead as boolean,
          createdAt: m.createdAt as string,
        }
        set((state) => ({
          chatMessages: {
            ...state.chatMessages,
            [roomId]: (state.chatMessages[roomId] || []).map(msg =>
              msg.id === tempMsg.id ? realMsg : msg
            ),
          },
        }))
      }
    } catch (error) {
      logger.warn({ component: 'chat', err: error }, 'Send chat message error')
    }
  },

  createChatRoom: async (sellerId, productId) => {
    try {
      const res = await apiClient.rawPost('/api/chat/rooms', { sellerId, productId })
      if (!res.ok) throw new Error('Failed to create chat room')
      const data = await res.json()
      if (data.success && data.data) {
        const r = data.data as Record<string, unknown>
        const otherUser = r.otherUser as Record<string, unknown> | undefined
        const productData = r.product as Record<string, unknown> | undefined
        const room: ChatRoom = {
          id: r.id as string,
          seller: mapChatSeller(otherUser),
          lastMessage: (r.lastMessage as string) || '',
          lastMessageTime: (r.lastMessageTime as string) || (r.updatedAt as string) || new Date().toISOString(),
          unreadCount: 0,
          product: productData ? mapChatProductPreview(productData) as unknown as Product : undefined,
        }
        // Add to local state if not already present
        if (!get().chatRooms.find(cr => cr.id === room.id)) {
          get().addChatRoom(room)
        }

        // Join the new room via WebSocket
        if (socket && get().isSocketConnected) {
          socket.emit('join-room', { roomId: room.id })
        }

        return room.id
      }
      return null
    } catch (error) {
      logger.warn({ component: 'chat', err: error }, 'Create chat room error')
      return null
    }
  },

  connectSocket: () => {
    // Don't connect if already connected or connecting
    if (socket?.connected) return

    // Check auth via session cookie flag (primary) or localStorage (fallback)
    const isAuth = hasAuthFlagCookie() || !!localStorage.getItem('authToken')
    if (!isAuth) return

    // If no WebSocket URL configured, skip WebSocket entirely (REST-only chat)
    if (!isWsAvailable) {
      logger.info({ component: 'chat' }, 'WebSocket not configured — chat running in REST-only mode')
      return
    }

    // Disconnect any existing socket first
    if (socket) {
      socket.disconnect()
      socket = null
    }

    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    })

    // Handle connection
    socket.on('connect', () => {
      // Authenticate after connection
      // Session cookie is sent automatically by the browser via the handshake.
      // Also try sending the token from localStorage as a fallback for the auth event.
      const token = localStorage.getItem('authToken') || ''
      socket!.emit('auth', { token })
    })

    // Handle successful authentication
    socket.on('auth-success', () => {
      set({ isSocketConnected: true })

      // Join all existing chat rooms
      const { chatRooms } = get()
      chatRooms.forEach(room => {
        socket!.emit('join-room', { roomId: room.id })
      })
    })

    // Handle incoming new messages
    socket.on('new-message', (message: Record<string, unknown>) => {
      const roomId = message.roomId as string
      const msg: ChatMessage = {
        id: message.id as string,
        roomId,
        senderId: message.senderId as string,
        content: message.content as string,
        type: (message.type as ChatMessage['type']) || 'text',
        isRead: message.isRead as boolean,
        createdAt: message.createdAt as string,
      }

      // Only add if we don't already have this message (avoid duplicates from optimistic updates)
      const existingMessages = get().chatMessages[roomId] || []
      const isDuplicate = existingMessages.some(m => m.id === msg.id)
      const isTempReplacement = existingMessages.some(m => m.id.startsWith('temp-') && m.senderId === msg.senderId && m.content === msg.content)

      if (isTempReplacement) {
        // Replace the temp message with the real one from the server
        set((state) => ({
          chatMessages: {
            ...state.chatMessages,
            [roomId]: (state.chatMessages[roomId] || []).map(m =>
              m.id.startsWith('temp-') && m.senderId === msg.senderId && m.content === msg.content ? msg : m
            ),
          },
          chatRooms: state.chatRooms.map(r =>
            r.id === roomId
              ? { ...r, lastMessage: msg.content, lastMessageTime: msg.createdAt }
              : r
          ),
        }))
      } else if (!isDuplicate) {
        // New message from another user — add it
        get().addChatMessage(roomId, msg)
      }
    })

    // Handle typing indicators
    socket.on('user-typing', (data: { roomId: string; userId: string; isTyping: boolean }) => {
      set((state) => {
        const currentTyping = state.typingUsers[data.roomId] || []
        let updatedTyping: string[]

        if (data.isTyping) {
          // Add user to typing list if not already there
          updatedTyping = currentTyping.includes(data.userId)
            ? currentTyping
            : [...currentTyping, data.userId]
        } else {
          // Remove user from typing list
          updatedTyping = currentTyping.filter(id => id !== data.userId)
        }

        return {
          typingUsers: {
            ...state.typingUsers,
            [data.roomId]: updatedTyping,
          },
        }
      })
    })

    // Handle messages read by other user
    socket.on('messages-read', (data: { roomId: string; userId: string }) => {
      set((state) => {
        const roomMessages = state.chatMessages[data.roomId]
        if (!roomMessages) return state

        const currentUserId = state.currentUser?.id
        const updatedMessages = {
          ...state.chatMessages,
          [data.roomId]: roomMessages.map(m =>
            m.senderId === currentUserId ? { ...m, isRead: true } : m
          ),
        }

        return { chatMessages: updatedMessages }
      })
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      set({ isSocketConnected: false })
    })

    // Handle connection errors
    socket.on('connect_error', (error) => {
      logger.warn({ component: 'chat', err: error }, 'Socket connection error')
      set({ isSocketConnected: false })
    })

    // Now actually connect
    socket.connect()
  },

  disconnectSocket: () => {
    if (socket) {
      socket.disconnect()
      socket = null
    }
    set({ isSocketConnected: false, typingUsers: {} })
  },

  emitTyping: (roomId, isTyping) => {
    if (socket && get().isSocketConnected) {
      socket.emit('typing', { roomId, isTyping })
    }
  },
})
