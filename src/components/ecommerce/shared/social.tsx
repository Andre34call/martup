"use client"

import { motion } from "framer-motion"
import { Package, Gift, Bell, MessageCircle, Check } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

// ==================== NOTIFICATION ITEM ====================
interface NotificationItemProps {
  title: string
  content: string
  type: "order" | "promo" | "system" | "chat"
  isRead: boolean
  createdAt: string
  onClick?: () => void
}

const notificationIcons: Record<string, React.ReactNode> = {
  order: <Package className="w-5 h-5 text-blue-500" />,
  promo: <Gift className="w-5 h-5 text-orange-500" />,
  system: <Bell className="w-5 h-5 text-gray-500" />,
  chat: <MessageCircle className="w-5 h-5 text-emerald-500" />,
}

export function NotificationItem({
  title,
  content,
  type,
  isRead,
  createdAt,
  onClick,
}: NotificationItemProps) {
  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
        isRead ? "bg-card" : "bg-emerald-50/50 dark:bg-emerald-950/20"
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
        {notificationIcons[type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={`text-sm ${isRead ? "font-medium" : "font-bold"} text-foreground truncate`}>
            {title}
          </h4>
          {!isRead && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{content}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(createdAt)}</p>
      </div>
    </motion.div>
  )
}

// ==================== AVATAR WITH NAME ====================
interface AvatarWithNameProps {
  name: string
  subtitle?: string
  avatarUrl?: string
  size?: "sm" | "md" | "lg"
  isVerified?: boolean
  onClick?: () => void
}

export function AvatarWithName({
  name,
  subtitle,
  avatarUrl,
  size = "md",
  isVerified,
  onClick,
}: AvatarWithNameProps) {
  const sizeMap = {
    sm: { avatar: "w-8 h-8 text-xs", name: "text-xs", sub: "text-[10px]" },
    md: { avatar: "w-10 h-10 text-sm", name: "text-sm", sub: "text-xs" },
    lg: { avatar: "w-12 h-12 text-base", name: "text-base", sub: "text-sm" },
  }

  const s = sizeMap[size]

  const colors = [
    "bg-emerald-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-violet-500",
    "bg-cyan-500",
    "bg-amber-500",
  ]
  const colorIndex = name.charCodeAt(0) % colors.length

  return (
    <div
      className={`flex items-center gap-2.5 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="relative flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className={`${s.avatar} rounded-full object-cover`}
            onError={(e) => {
              // Hide broken image and show fallback initial instead
              const img = e.currentTarget as HTMLImageElement
              img.style.display = 'none'
              if (img.nextElementSibling) {
                (img.nextElementSibling as HTMLElement).style.display = 'flex'
              }
            }}
          />
        ) : null}
        <div
          className={`${s.avatar} rounded-full ${colors[colorIndex]} text-white font-bold items-center justify-center`}
          style={{ display: avatarUrl ? 'none' : 'flex' }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        {isVerified && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-background">
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className={`${s.name} font-medium text-foreground truncate`}>{name}</p>
        {subtitle && (
          <p className={`${s.sub} text-muted-foreground truncate`}>{subtitle}</p>
        )}
      </div>
    </div>
  )
}
