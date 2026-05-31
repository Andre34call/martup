"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Heart, ShoppingCart, MessageCircle, User, Home, Grid3X3, Check, BarChart3, Users, Package, TrendingUp, ArrowLeftCircle } from "lucide-react"
import { useAppStore, useCartStore } from "@/lib/store"
import type { ScreenName } from "@/lib/types"
import { useState, useEffect, useRef } from "react"

// ==================== BOTTOM NAV (Buyer) ====================
const navItems = [
  { key: "home" as const, label: "Home", icon: Home, screens: ["home", "splash", "onboarding", "login", "register", "otp", "forgot-password"] },
  { key: "category" as const, label: "Category", icon: Grid3X3, screens: ["category", "search"] },
  { key: "chat" as const, label: "Chat", icon: MessageCircle, screens: ["chat", "chat-room"] },
  { key: "profile" as const, label: "Profile", icon: User, screens: ["profile", "settings", "orders", "wallet", "deposit", "withdraw", "notification", "voucher", "address", "followed-stores", "wishlist", "review", "refund", "help", "seller-dashboard", "seller-products", "seller-add-product", "seller-orders", "seller-analytics", "seller-chat", "seller-settings", "seller-campaign", "seller-wallet", "admin-dashboard", "admin-users", "admin-products", "admin-orders", "admin-withdraw", "admin-banner", "admin-analytics", "admin-complaints"] },
]

export function BottomNav() {
  const { currentScreen, navigate, totalUnreadChats } = useAppStore()
  const { getTotalItemCount } = useCartStore()

  const cartCount = getTotalItemCount()

  const getActiveTab = (): number => {
    const idx = navItems.findIndex(item => item.screens.includes(currentScreen))
    return idx >= 0 ? idx : 0
  }

  const activeTab = getActiveTab()

  const handleTabPress = (idx: number) => {
    if (idx === 3) {
      navigate("profile")
      return
    }
    const screenMap: Record<string, ScreenName> = {
      home: "home",
      category: "category",
      chat: "chat",
    }
    navigate(screenMap[navItems[idx].key] || "home")
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[430px] md:max-w-[480px]">
        <div className="glass border-t border-border/50 pb-safe">
          <nav className="relative flex items-center justify-around h-16">
            {/* Sliding indicator */}
            <motion.div
              className="absolute top-0 h-0.5 bg-emerald-500 rounded-full"
              initial={false}
              animate={{
                left: `calc(${activeTab * 25}% + 12.5% - 20px)`,
                width: '40px',
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />

            {navItems.map((item, idx) => {
              const Icon = item.icon
              const isActive = activeTab === idx

              return (
                <button
                  key={item.key}
                  onClick={() => handleTabPress(idx)}
                  className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className="relative"
                  >
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        isActive ? "text-emerald-600" : "text-muted-foreground"
                      }`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {/* Chat badge */}
                    {item.key === "chat" && totalUnreadChats > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1"
                      >
                        {totalUnreadChats > 99 ? "99+" : totalUnreadChats}
                      </motion.span>
                    )}
                  </motion.div>
                  <span
                    className={`text-[10px] font-medium transition-colors ${
                      isActive ? "text-emerald-600" : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}

// ==================== ADMIN BOTTOM NAV ====================
export function AdminBottomNav() {
  const { currentScreen, navigate, userRole, isSuperAdminUser, switchRole } = useAppStore()

  const items = [
    { key: "admin-dashboard", label: "Home", icon: BarChart3, screen: "admin-dashboard" as ScreenName },
    { key: "admin-users", label: "Users", icon: Users, screen: "admin-users" as ScreenName },
    { key: "admin-products", label: "Products", icon: Package, screen: "admin-products" as ScreenName },
    { key: "admin-analytics", label: "Stats", icon: TrendingUp, screen: "admin-analytics" as ScreenName },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[430px] md:max-w-[480px] relative">
        <div className="glass border-t border-border/50 pb-safe">
          <nav className="flex items-center justify-around h-16">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = currentScreen === item.screen
              return (
                <motion.button key={item.key} whileTap={{ scale: 0.9 }}
                  onClick={() => item.screen && navigate(item.screen)}
                  className="relative flex flex-col items-center justify-center gap-0.5 w-14 h-full"
                >
                  <Icon className={`w-5 h-5 ${isActive ? (isSuperAdminUser ? "text-red-600" : "text-blue-600") : "text-muted-foreground"}`} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-[10px] font-medium ${isActive ? (isSuperAdminUser ? "text-red-600" : "text-blue-600") : "text-muted-foreground"}`}>{item.label}</span>
                </motion.button>
              )
            })}
            {/* Back to Buyer button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => switchRole("buyer")}
              className="relative flex flex-col items-center justify-center gap-0.5 w-14 h-full"
            >
              <ArrowLeftCircle className={`w-5 h-5 text-muted-foreground`} strokeWidth={2} />
              <span className="text-[10px] font-medium text-muted-foreground">Buyer</span>
            </motion.button>
          </nav>
        </div>
      </div>
    </div>
  )
}

// ==================== SELLER BOTTOM NAV ====================
export function SellerBottomNav() {
  const { currentScreen, navigate, switchRole } = useAppStore()

  const items = [
    { key: "seller-dashboard", label: "Home", icon: BarChart3, screen: "seller-dashboard" as ScreenName },
    { key: "seller-products", label: "Produk", icon: Package, screen: "seller-products" as ScreenName },
    { key: "seller-orders", label: "Pesanan", icon: ShoppingCart, screen: "seller-orders" as ScreenName },
    { key: "seller-chat", label: "Chat", icon: MessageCircle, screen: "seller-chat" as ScreenName },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[430px] md:max-w-[480px] relative">
        <div className="glass border-t border-border/50 pb-safe">
          <nav className="flex items-center justify-around h-16">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = currentScreen === item.screen
              return (
                <motion.button key={item.key} whileTap={{ scale: 0.9 }}
                  onClick={() => item.screen && navigate(item.screen)}
                  className="relative flex flex-col items-center justify-center gap-0.5 w-14 h-full"
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-orange-600" : "text-muted-foreground"}`} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-[10px] font-medium ${isActive ? "text-orange-600" : "text-muted-foreground"}`}>{item.label}</span>
                </motion.button>
              )
            })}
            {/* Back to Buyer button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => switchRole("buyer")}
              className="relative flex flex-col items-center justify-center gap-0.5 w-14 h-full"
            >
              <ArrowLeftCircle className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
              <span className="text-[10px] font-medium text-muted-foreground">Buyer</span>
            </motion.button>
          </nav>
        </div>
      </div>
    </div>
  )
}
