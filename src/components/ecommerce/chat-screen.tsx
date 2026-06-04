"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/utils"
import { PageHeader, EmptyState, SearchBar } from "./shared"
import type { ChatRoom, ChatMessage } from "@/lib/types"
import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import {
  ArrowLeft, Search, Phone, MoreVertical, Send, Paperclip,
  Image as ImageIcon, MessageCircle, ChevronRight, Check, CheckCheck,
  Store, Smile
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// ==================== CHAT ROOM ITEM ====================
function ChatRoomItem({ room, onTap }: { room: ChatRoom; onTap: () => void }) {
  const colors = [
    "bg-emerald-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-violet-500",
    "bg-cyan-500",
  ]
  const colorIndex = room.seller.storeName.charCodeAt(0) % colors.length

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={onTap}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {room.seller.storeAvatar ? (
          <img
            src={room.seller.storeAvatar}
            alt={room.seller.storeName}
            className="w-12 h-12 rounded-full object-cover"
            onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.style.display = 'none'; if (img.nextElementSibling) (img.nextElementSibling as HTMLElement).style.display = 'flex' }}
          />
        ) : null}
        <div
          className={`w-12 h-12 rounded-full ${colors[colorIndex]} text-white font-bold items-center justify-center`}
          style={{ display: room.seller.storeAvatar ? 'none' : 'flex' }}
        >
          {room.seller.storeName.charAt(0)}
        </div>
        {room.unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-background">
            {room.unreadCount > 9 ? "9+" : room.unreadCount}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground truncate">{room.seller.storeName}</h4>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {formatRelativeTime(room.lastMessageTime)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-xs truncate ${room.unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {room.lastMessage}
          </p>
          {room.unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold flex-shrink-0">
              {room.unreadCount}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ==================== CHAT ROOM SCREEN (Full-screen, no bottom nav) ====================
export function ChatRoomScreen() {
  const { chatRooms, selectedChatRoomId, setSelectedChatRoom, goBack, showToast } = useAppStore()
  const room = chatRooms.find((r) => r.id === selectedChatRoomId) || null

  if (!room) {
    return (
      <div className="flex flex-col h-dvh bg-background">
        <div className="flex-shrink-0 z-40 glass">
          <div className="flex items-center justify-between h-14 px-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={goBack}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <p className="text-sm font-semibold text-foreground">Chat</p>
            <div className="w-9" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<MessageCircle className="w-10 h-10 text-muted-foreground" />}
            title="Chat Tidak Ditemukan"
            subtitle="Kembali ke daftar chat"
            actionLabel="Kembali"
            onAction={goBack}
          />
        </div>
      </div>
    )
  }

  return <ChatRoomView room={room} onBack={() => { setSelectedChatRoom(null); goBack() }} />
}

// ==================== CHAT ROOM VIEW ====================
function ChatRoomView({ room, onBack }: { room: ChatRoom; onBack: () => void }) {
  const { showToast, chatMessages, currentUser, markChatRead, fetchChatMessages, sendChatMessage, emitTyping, typingUsers, isSocketConnected } = useAppStore()
  const [message, setMessage] = useState("")
  const messages = chatMessages[room.id] || []
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch messages from API when entering a chat room
  useEffect(() => {
    if (room?.id) {
      fetchChatMessages(room.id)
    }
  }, [room?.id, fetchChatMessages])

  useEffect(() => {
    markChatRead(room.id)
  }, [room.id, markChatRead])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleInputChange = useCallback((value: string) => {
    setMessage(value)
    emitTyping(room.id, value.length > 0)
  }, [room.id, emitTyping])

  const handleSend = useCallback(() => {
    if (!message.trim()) return
    sendChatMessage(room.id, message.trim())
    setMessage("")
    emitTyping(room.id, false)
    inputRef.current?.focus()
  }, [message, room.id, sendChatMessage, emitTyping])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const isMyMessage = (senderId: string) => senderId === (currentUser?.id || "u1")

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <PageHeader
        title={room.seller.storeName}
        onBack={onBack}
        rightAction={
          <div className="flex items-center gap-1">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
              onClick={() => showToast("Fitur panggilan segera hadir!", "info")}
            >
              <Phone className="w-4.5 h-4.5 text-muted-foreground" />
            </button>
            <button
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
              onClick={() => showToast("Opsi lainnya", "info")}
            >
              <MoreVertical className="w-4.5 h-4.5 text-muted-foreground" />
            </button>
          </div>
        }
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Date separator */}
        <div className="flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
            Hari Ini
          </span>
        </div>

        {messages.map((msg, idx) => {
          const isMine = isMyMessage(msg.senderId)
          const showAvatar = !isMine && (idx === 0 || messages[idx - 1]?.senderId !== msg.senderId)

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex items-end gap-2 max-w-[80%] ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar placeholder */}
                {!isMine && (
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 ${showAvatar ? "bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px]" : "invisible"}`}>
                    {showAvatar ? room.seller.storeName.charAt(0) : ""}
                  </div>
                )}

                {/* Message bubble */}
                <div>
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl ${
                      isMine
                        ? "bg-emerald-500 text-white rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>
                  <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "justify-end" : "justify-start"}`}>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMine && (
                      msg.isRead ? (
                        <CheckCheck className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Check className="w-3 h-3 text-muted-foreground" />
                      )
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
        {/* Typing indicator */}
        {(() => {
          const roomTypingUsers = typingUsers[room.id] || []
          const otherTyping = roomTypingUsers.filter(id => id !== currentUser?.id)
          return otherTyping.length > 0
        })() && (
          <div className="flex items-center gap-2 px-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-muted-foreground">Mengetik...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Product Context */}
      {room.product && (
        <div className="px-4 py-2 border-t border-border/30">
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Store className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{room.product.name}</p>
              <p className="text-[10px] text-emerald-600 font-semibold">{formatPrice(room.product.price)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="flex-shrink-0 bg-background border-t border-border/30 px-4 py-3 pb-safe">
        <div className="flex items-center gap-2">
          <button
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors flex-shrink-0"
            onClick={() => showToast("Fitur lampiran segera hadir!", "info")}
          >
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan..."
              className="h-10 rounded-full bg-muted/50 border-border/50 pr-10 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              onClick={() => showToast("Emoji segera hadir!", "info")}
            >
              <Smile className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!message.trim()}
            className={`w-10 h-10 flex items-center justify-center rounded-full flex-shrink-0 transition-colors ${
              message.trim()
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}

// ==================== CHAT SCREEN ====================
export function ChatScreen() {
  const { chatRooms, navigate, setSelectedChatRoom, fetchChatRooms, connectSocket } = useAppStore()
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch chat rooms from API on mount
  useEffect(() => {
    fetchChatRooms()
  }, [fetchChatRooms])

  // Connect WebSocket for real-time chat
  useEffect(() => {
    connectSocket()
  }, [connectSocket])

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return chatRooms
    const q = searchQuery.toLowerCase()
    return chatRooms.filter(
      (r) =>
        r.seller.storeName.toLowerCase().includes(q) ||
        r.lastMessage.toLowerCase().includes(q)
    )
  }, [chatRooms, searchQuery])

  const handleRoomTap = useCallback((roomId: string) => {
    setSelectedChatRoom(roomId)
    navigate("chat-room")
  }, [setSelectedChatRoom, navigate])

  // Room view is now handled by ChatRoomScreen as a separate screen
  // This keeps the chat list always rendered when on "chat" screen

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="Chat"
        showBack={false}
        rightAction={
          <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </button>
        }
      />

      <div className="flex-1 pb-20">
        {/* Search Bar */}
        <div className="px-4 pb-3">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Cari chat..."
          />
        </div>

        {/* Chat List */}
        <div className="bg-card rounded-xl border border-border/50 mx-4">
          <AnimatePresence mode="wait">
            {filteredRooms.length > 0 ? (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {filteredRooms.map((room, idx) => (
                  <div key={room.id}>
                    <ChatRoomItem room={room} onTap={() => handleRoomTap(room.id)} />
                    {idx < filteredRooms.length - 1 && (
                      <div className="ml-[72px] border-b border-border/30" />
                    )}
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <EmptyState
                  icon={<MessageCircle className="w-10 h-10 text-muted-foreground" />}
                  title="Belum Ada Chat"
                  subtitle="Mulai chat dengan seller untuk bertanya tentang produk"
                  actionLabel="Cari Produk"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
