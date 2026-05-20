"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatRelativeTime } from "@/lib/mock-data"
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

// Mock messages for chat room
const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  "1": [
    { id: "m1", roomId: "1", senderId: "s1", content: "Halo kak, terima kasih sudah order di toko kami! 🙏", type: "text", isRead: true, createdAt: "2024-12-20T10:00:00Z" },
    { id: "m2", roomId: "1", senderId: "u1", content: "Sama-sama kak, kira-kira barangnya kapan dikirim?", type: "text", isRead: true, createdAt: "2024-12-20T10:05:00Z" },
    { id: "m3", roomId: "1", senderId: "s1", content: "Barangnya sudah kami pak hari ini ya kak, estimasi 2-3 hari sampai", type: "text", isRead: true, createdAt: "2024-12-20T10:10:00Z" },
    { id: "m4", roomId: "1", senderId: "u1", content: "Siap kak, ditunggu ya 🙌", type: "text", isRead: true, createdAt: "2024-12-20T10:12:00Z" },
    { id: "m5", roomId: "1", senderId: "s1", content: "Iya kak, kami sudah kirim pakai JNE REG, nomor resinya JNE1234567890 ya", type: "text", isRead: true, createdAt: "2024-12-20T10:20:00Z" },
    { id: "m6", roomId: "1", senderId: "u1", content: "Oke noted kak, makasih banyak!", type: "text", isRead: true, createdAt: "2024-12-20T10:22:00Z" },
    { id: "m7", roomId: "1", senderId: "s1", content: "Sama-sama kak, kalau ada pertanyaan lagi bisa chat langsung ya 😊", type: "text", isRead: true, createdAt: "2024-12-20T10:25:00Z" },
    { id: "m8", roomId: "1", senderId: "s1", content: "Terima kasih sudah order kak! 🙏", type: "text", isRead: false, createdAt: "2024-12-20T10:30:00Z" },
  ],
  "2": [
    { id: "m9", roomId: "2", senderId: "u1", content: "Halo kak, apa barang ini ready?", type: "text", isRead: true, createdAt: "2024-12-20T09:00:00Z" },
    { id: "m10", roomId: "2", senderId: "s2", content: "Barang ready kak, silakan order", type: "text", isRead: true, createdAt: "2024-12-20T09:15:00Z" },
  ],
  "3": [
    { id: "m11", roomId: "3", senderId: "u1", content: "Kak, kapan restock lagi?", type: "text", isRead: true, createdAt: "2024-12-19T15:30:00Z" },
    { id: "m12", roomId: "3", senderId: "s3", content: "Bisa restock minggu depan ya kak", type: "text", isRead: false, createdAt: "2024-12-19T16:00:00Z" },
  ],
}

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
          />
        ) : (
          <div className={`w-12 h-12 rounded-full ${colors[colorIndex]} text-white font-bold flex items-center justify-center`}>
            {room.seller.storeName.charAt(0)}
          </div>
        )}
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

// ==================== CHAT ROOM VIEW ====================
function ChatRoomView({ room, onBack }: { room: ChatRoom; onBack: () => void }) {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES[room.id] || [])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = useCallback(() => {
    if (!message.trim()) return
    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      roomId: room.id,
      senderId: "u1",
      content: message.trim(),
      type: "text",
      isRead: false,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, newMsg])
    setMessage("")
    inputRef.current?.focus()
  }, [message, room.id])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const isMyMessage = (senderId: string) => senderId === "u1"

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 glass">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-xs">
                {room.seller.storeName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{room.seller.storeName}</p>
                <p className="text-[10px] text-emerald-500">Online</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
              <Phone className="w-4.5 h-4.5 text-muted-foreground" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
              <MoreVertical className="w-4.5 h-4.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

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
              <p className="text-[10px] text-emerald-600 font-semibold">{formatRelativeTime(room.lastMessageTime)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="sticky bottom-0 bg-background border-t border-border/30 px-4 py-3 pb-safe">
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors flex-shrink-0">
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan..."
              className="h-10 rounded-full bg-muted/50 border-border/50 pr-10 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
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
  const { chatRooms } = useAppStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)

  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null
    return chatRooms.find((r) => r.id === selectedRoomId) || null
  }, [chatRooms, selectedRoomId])

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
    setSelectedRoomId(roomId)
  }, [])

  const handleBackFromRoom = useCallback(() => {
    setSelectedRoomId(null)
  }, [])

  if (selectedRoom) {
    return <ChatRoomView room={selectedRoom} onBack={handleBackFromRoom} />
  }

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
