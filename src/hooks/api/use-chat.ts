'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { ChatRoom, ChatMessage } from '@/lib/types'

// ==================== Types ====================

interface ChatRoomsResponse {
  rooms: ChatRoom[]
}

interface ChatMessagesResponse {
  messages: ChatMessage[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface SendMessageData {
  roomId: string
  senderId: string
  content: string
  type?: 'text' | 'image' | 'product' | 'order'
}

interface CreateChatRoomData {
  buyerId: string
  sellerId: string
  productId?: string
}

// ==================== Query Keys ====================

export const chatKeys = {
  all: ['chat'] as const,
  rooms: (userId: string) => [...chatKeys.all, 'rooms', userId] as const,
  messages: (roomId: string) => [...chatKeys.all, 'messages', roomId] as const,
}

// ==================== Hooks ====================

export function useChatRooms(userId: string | null) {
  return useQuery({
    queryKey: chatKeys.rooms(userId || ''),
    queryFn: () => apiClient.get<ChatRoomsResponse>('/api/chat/rooms', { userId: userId || undefined }),
    enabled: !!userId,
  })
}

export function useChatMessages(roomId: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(roomId || ''),
    queryFn: () => apiClient.get<ChatMessagesResponse>(`/api/chat/rooms/${roomId}/messages`),
    enabled: !!roomId,
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SendMessageData) =>
      apiClient.post<{ message: ChatMessage }>(`/api/chat/rooms/${data.roomId}/messages`, {
        senderId: data.senderId,
        content: data.content,
        type: data.type || 'text',
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.roomId) })
      // Also invalidate rooms list to update last message
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] })
    },
  })
}

export function useCreateChatRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateChatRoomData) =>
      apiClient.post<{ room: ChatRoom }>('/api/chat/rooms', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.rooms(variables.buyerId) })
    },
  })
}
