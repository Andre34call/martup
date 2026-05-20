"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useAppStore } from "@/lib/store"
import { formatRelativeTime } from "@/lib/mock-data"
import { PageHeader, EmptyState, TabBar, NotificationItem } from "./shared"
import type { Notification as AppNotification } from "@/lib/types"
import { useState, useMemo, useCallback } from "react"
import {
  Package, Gift, Bell, MessageCircle, CheckCheck, Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"

const NOTIFICATION_TABS = [
  { key: "all", label: "Semua" },
  { key: "order", label: "Pesanan" },
  { key: "promo", label: "Promo" },
  { key: "system", label: "Sistem" },
]

// ==================== NOTIFICATION SCREEN ====================
export function NotificationScreen() {
  const { notifications, markNotificationRead, markAllNotificationsRead, setSelectedOrder, navigate } = useAppStore()
  const [activeTab, setActiveTab] = useState("all")

  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications
    return notifications.filter((n) => n.type === activeTab)
  }, [notifications, activeTab])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  )

  const tabCounts = useMemo(() => ({
    all: notifications.length,
    order: notifications.filter((n) => n.type === "order").length,
    promo: notifications.filter((n) => n.type === "promo").length,
    system: notifications.filter((n) => n.type === "system").length,
  }), [notifications])

  const tabsWithCounts = NOTIFICATION_TABS.map((tab) => ({
    ...tab,
    count: tabCounts[tab.key as keyof typeof tabCounts] || 0,
  }))

  const handleNotificationTap = useCallback((id: string) => {
    const notification = notifications.find(n => n.id === id)
    if (!notification) return
    markNotificationRead(id)
    if (notification.type === 'order') {
      setSelectedOrder(id)
      navigate('orders')
    } else if (notification.type === 'promo') {
      navigate('voucher')
    } else if (notification.type === 'chat') {
      navigate('chat')
    }
  }, [notifications, markNotificationRead, setSelectedOrder, navigate])

  const handleMarkAllRead = useCallback(() => {
    markAllNotificationsRead()
  }, [markAllNotificationsRead])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageHeader
        title="Notifikasi"
        rightAction={
          unreadCount > 0 ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors px-2 py-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Baca Semua
            </motion.button>
          ) : undefined
        }
      />

      <div className="flex-1 pb-20">
        {/* Tab Bar */}
        <div className="sticky top-14 z-30 bg-background">
          <TabBar
            tabs={tabsWithCounts}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Notification List */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            {filteredNotifications.length > 0 ? (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                {filteredNotifications.map((notification, idx) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <NotificationItem
                      title={notification.title}
                      content={notification.content}
                      type={notification.type as "order" | "promo" | "system" | "chat"}
                      isRead={notification.isRead}
                      createdAt={notification.createdAt}
                      onClick={() => handleNotificationTap(notification.id)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={`empty-${activeTab}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <EmptyState
                  icon={
                    activeTab === "order" ? (
                      <Package className="w-10 h-10 text-muted-foreground" />
                    ) : activeTab === "promo" ? (
                      <Gift className="w-10 h-10 text-muted-foreground" />
                    ) : activeTab === "system" ? (
                      <Bell className="w-10 h-10 text-muted-foreground" />
                    ) : (
                      <Bell className="w-10 h-10 text-muted-foreground" />
                    )
                  }
                  title="Belum Ada Notifikasi"
                  subtitle="Notifikasi kamu akan muncul di sini"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
