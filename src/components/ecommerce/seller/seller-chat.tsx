"use client"

import { motion } from "framer-motion"
import { MessageCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useAppStore } from "@/lib/store"
import { formatRelativeTime } from "@/lib/utils"
import { fadeIn, stagger } from '@/lib/animations'
import { PageHeader, SectionHeader, EmptyState } from "../shared"
import { useState } from "react"

export function SellerChat() {
  const { navigate, setSelectedChatRoom, chatRooms } = useAppStore()
  const [autoReply, setAutoReply] = useState(false)

  return (
    <div className="pb-20">
      <PageHeader title="Chat Pembeli" />

      <div className="px-4 space-y-4">
        {/* Auto-Reply Toggle */}
        <motion.div {...fadeIn}>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-cyan-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-Reply</p>
                  <p className="text-xs text-muted-foreground">Balas otomatis saat offline</p>
                </div>
              </div>
              <Switch checked={autoReply} onCheckedChange={setAutoReply} />
            </div>
          </Card>
        </motion.div>

        {/* Chat List */}
        <motion.div {...fadeIn}>
          <SectionHeader title="Daftar Chat" />
          <div className="space-y-2 mt-3">
            {chatRooms.length === 0 ? (
              <EmptyState
                icon={<MessageCircle className="w-10 h-10 text-muted-foreground" />}
                title="Belum Ada Chat"
                subtitle="Chat dari pembeli akan muncul di sini"
              />
            ) : (
              chatRooms.map((room, i) => (
                <motion.div key={room.id} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => {
                    setSelectedChatRoom(room.id)
                    navigate("chat-room")
                  }}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center">
                          {room.seller?.storeName?.charAt(0) || '?'}
                        </div>
                        {room.unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                            {room.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{room.seller?.storeName || 'Pembeli'}</p>
                          <p className="text-[10px] text-muted-foreground">{formatRelativeTime(room.lastMessageTime)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{room.lastMessage}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
