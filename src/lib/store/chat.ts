import type { StateCreator } from 'zustand'
import type { ChatSlice, AppStore } from './types'
import type { ChatRoom, ChatMessage } from '../types'
import { getAuthHeaders } from './getAuthHeaders'

export const createChatSlice: StateCreator<AppStore, [], [], ChatSlice> = (set, get) => ({
  chatRooms: [],
  chatMessages: {},
  totalUnreadChats: 0,
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
    // Mark as read on server
    fetch('/api/chat/messages', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ roomId }),
    }).catch(() => {})

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
      const res = await fetch('/api/chat/rooms', { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch chat rooms')
      const data = await res.json()
      if (data.success && data.data) {
        const rooms: ChatRoom[] = (data.data as Array<Record<string, unknown>>).map((r: Record<string, unknown>) => {
          const otherUser = r.otherUser as Record<string, unknown> | undefined
          const sellerData = (otherUser?.seller as Record<string, unknown>) || {}
          const productData = r.product as Record<string, unknown> | undefined
          return {
            id: r.id as string,
            seller: {
              id: sellerData.id as string || otherUser?.id as string || '',
              userId: otherUser?.id as string || '',
              storeName: (otherUser?.name as string) || (sellerData.storeName as string) || 'Seller',
              storeSlug: (sellerData.storeSlug as string) || '',
              storeAvatar: (otherUser?.avatar as string) || (sellerData.storeAvatar as string) || undefined,
              isVerified: (sellerData.isVerified as boolean) || false,
              isPremium: (sellerData.isPremium as boolean) || false,
              rating: (sellerData.rating as number) || 0,
              totalSales: (sellerData.totalSales as number) || 0,
              totalProducts: (sellerData.totalProducts as number) || 0,
            },
            lastMessage: (r.lastMessage as string) || '',
            lastMessageTime: (r.lastMessageTime as string) || (r.updatedAt as string) || new Date().toISOString(),
            unreadCount: (r.unreadCount as number) || 0,
            product: productData ? {
              id: productData.id as string,
              name: productData.name as string,
              price: productData.price as number,
              images: typeof productData.images === 'string' ? JSON.parse(productData.images) : (productData.images as string[]) || [],
            } as any : undefined,
          }
        })
        const totalUnreadChats = rooms.reduce((sum, r) => sum + r.unreadCount, 0)
        set({ chatRooms: rooms, totalUnreadChats })
      }
    } catch (error) {
      console.error('Fetch chat rooms error:', error)
    }
  },
  fetchChatMessages: async (roomId) => {
    try {
      const res = await fetch(`/api/chat/messages?roomId=${roomId}`, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to fetch chat messages')
      const data = await res.json()
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
      console.error('Fetch chat messages error:', error)
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

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roomId, content, type }),
      })
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
      console.error('Send chat message error:', error)
    }
  },
  createChatRoom: async (sellerId, productId) => {
    try {
      const res = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sellerId, productId }),
      })
      if (!res.ok) throw new Error('Failed to create chat room')
      const data = await res.json()
      if (data.success && data.data) {
        const r = data.data as Record<string, unknown>
        const otherUser = r.otherUser as Record<string, unknown> | undefined
        const sellerData = (otherUser?.seller as Record<string, unknown>) || {}
        const productData = r.product as Record<string, unknown> | undefined
        const room: ChatRoom = {
          id: r.id as string,
          seller: {
            id: sellerData.id as string || otherUser?.id as string || '',
            userId: otherUser?.id as string || '',
            storeName: (otherUser?.name as string) || (sellerData.storeName as string) || 'Seller',
            storeSlug: (sellerData.storeSlug as string) || '',
            storeAvatar: (otherUser?.avatar as string) || (sellerData.storeAvatar as string) || undefined,
            isVerified: (sellerData.isVerified as boolean) || false,
            isPremium: (sellerData.isPremium as boolean) || false,
            rating: (sellerData.rating as number) || 0,
            totalSales: (sellerData.totalSales as number) || 0,
            totalProducts: (sellerData.totalProducts as number) || 0,
          },
          lastMessage: (r.lastMessage as string) || '',
          lastMessageTime: (r.lastMessageTime as string) || (r.updatedAt as string) || new Date().toISOString(),
          unreadCount: 0,
          product: productData ? {
            id: productData.id as string,
            name: productData.name as string,
            price: productData.price as number,
            images: typeof productData.images === 'string' ? JSON.parse(productData.images) : (productData.images as string[]) || [],
          } as any : undefined,
        }
        // Add to local state if not already present
        if (!get().chatRooms.find(cr => cr.id === room.id)) {
          get().addChatRoom(room)
        }
        return room.id
      }
      return null
    } catch (error) {
      console.error('Create chat room error:', error)
      return null
    }
  },
})
