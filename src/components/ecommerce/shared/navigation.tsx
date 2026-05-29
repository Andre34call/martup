"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Heart, ShoppingCart, MessageCircle, User, Home, Grid3X3, Check, BarChart3, Users, Package, TrendingUp } from "lucide-react"
import { useAppStore, useCartStore } from "@/lib/store"
import type { ScreenName } from "@/lib/types"
import { useState, useEffect, useRef } from "react"

// ==================== BOTTOM NAV ====================
const navItems = [
  { key: "home" as const, label: "Home", icon: Home, screens: ["home", "splash", "onboarding", "login", "register", "otp", "forgot-password"] },
  { key: "category" as const, label: "Category", icon: Grid3X3, screens: ["category", "search"] },
  { key: "cart" as const, label: "Cart", icon: ShoppingCart, screens: ["cart", "checkout", "payment"] },
  { key: "chat" as const, label: "Chat", icon: MessageCircle, screens: ["chat", "chat-room"] },
  { key: "profile" as const, label: "Profile", icon: User, screens: ["profile", "settings", "orders", "wallet", "deposit", "withdraw", "notification", "voucher", "address", "followed-stores", "wishlist", "review", "refund", "help", "seller-dashboard", "seller-products", "seller-add-product", "seller-orders", "seller-analytics", "seller-chat", "seller-settings", "seller-campaign", "seller-wallet", "admin-dashboard", "admin-users", "admin-products", "admin-orders", "admin-withdraw", "admin-banner", "admin-analytics", "admin-complaints"] },
]

export function BottomNav() {
  const { currentScreen, navigate, userRole, currentUser, originalRole, switchRole, totalUnreadChats } = useAppStore()
  const { getTotalItemCount } = useCartStore()
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const roleMenuRef = useRef<HTMLDivElement>(null)

  const cartCount = getTotalItemCount()

  const getActiveTab = (): number => {
    const idx = navItems.findIndex(item => item.screens.includes(currentScreen))
    return idx >= 0 ? idx : 0
  }

  const activeTab = getActiveTab()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setShowRoleMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleTabPress = (idx: number) => {
    if (idx === 4) {
      navigate("profile")
      return
    }
    const screenMap: Record<string, ScreenName> = {
      home: "home",
      category: "category",
      cart: "cart",
      chat: "chat",
    }
    navigate(screenMap[navItems[idx].key] || "home")
  }

  const handleRoleSwitch = (role: "buyer" | "seller" | "admin" | "manager") => {
    switchRole(role)
    setShowRoleMenu(false)
  }

  const roleColors: Record<string, string> = {
    buyer: "bg-emerald-500",
    seller: "bg-orange-500",
    admin: "bg-purple-500",
    manager: "bg-violet-500",
  }

  const roleLabels: Record<string, string> = {
    buyer: "Buyer",
    seller: "Seller",
    admin: "Admin",
    manager: "Manager",
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[430px] md:max-w-[480px]">
        <div className="glass border-t border-border/50 pb-safe">
          <nav className="relative flex items-center justify-around h-16">
            {/* Sliding indicator */}
            <motion.div
              className="absolute top-0 h-0.5 w-10 bg-emerald-500 rounded-full"
              initial={false}
              animate={{
                left: `calc(${activeTab * 20}% + 10% - 20px)`,
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />

            {navItems.map((item, idx) => {
              const Icon = item.icon
              const isActive = activeTab === idx
              const isProfile = idx === 4

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
                    {/* Cart badge */}
                    {item.key === "cart" && cartCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold px-1"
                      >
                        {cartCount > 99 ? "99+" : cartCount}
                      </motion.span>
                    )}
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
                    {/* Profile role indicator - clickable to toggle role switcher */}
                    {isProfile && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowRoleMenu(!showRoleMenu)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation()
                            setShowRoleMenu(!showRoleMenu)
                          }
                        }}
                        className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border-2 border-background ${roleColors[userRole]} hover:scale-125 transition-transform cursor-pointer`}
                        title="Switch Role"
                      />
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

        {/* Role switcher popup */}
        <AnimatePresence>
          {showRoleMenu && (
            <motion.div
              ref={roleMenuRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-20 right-4 bg-card rounded-xl shadow-lg border border-border p-2 min-w-[160px]"
            >
              <p className="text-xs text-muted-foreground px-3 py-1.5 font-medium">Switch Role</p>
              {(["buyer", "seller", ...(['admin', 'manager'].includes(currentUser?.role || '') ? ["admin" as const, "manager" as const] : [])] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleSwitch(role)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    userRole === role
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${roleColors[role]}`} />
                  <span className="font-medium">{roleLabels[role]}</span>
                  {userRole === role && (
                    <Check className="w-3.5 h-3.5 ml-auto text-emerald-600" />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ==================== ADMIN BOTTOM NAV ====================
export function AdminBottomNav() {
  const { currentScreen, navigate, userRole, currentUser, originalRole, switchRole } = useAppStore()
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const roleMenuRef = useRef<HTMLDivElement>(null)

  const items = [
    { key: "admin-dashboard", label: "Home", icon: BarChart3, screen: "admin-dashboard" as ScreenName },
    { key: "admin-users", label: "Users", icon: Users, screen: "admin-users" as ScreenName },
    { key: "admin-products", label: "Products", icon: Package, screen: "admin-products" as ScreenName },
    { key: "admin-analytics", label: "Stats", icon: TrendingUp, screen: "admin-analytics" as ScreenName },
    { key: "switch", label: "Switch", icon: Users, screen: null },
  ]

  const roleColors: Record<string, string> = {
    buyer: "bg-emerald-500",
    seller: "bg-orange-500",
    admin: "bg-purple-500",
    manager: "bg-violet-500",
  }

  const roleLabels: Record<string, string> = {
    buyer: "Buyer",
    seller: "Seller",
    admin: "Admin",
    manager: "Manager",
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setShowRoleMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleRoleSwitch = (role: "buyer" | "seller" | "admin" | "manager") => {
    switchRole(role)
    setShowRoleMenu(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[430px] md:max-w-[480px] relative">
        <div className="glass border-t border-border/50 pb-safe">
          <nav className="flex items-center justify-around h-16">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = item.key !== "switch" && currentScreen === item.screen
              return (
                <motion.button key={item.key} whileTap={{ scale: 0.9 }}
                  onClick={() => item.key === "switch" ? setShowRoleMenu(!showRoleMenu) : item.screen && navigate(item.screen)}
                  className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full"
                >
                  <Icon className={`w-5 h-5 ${isActive || item.key === "switch" ? "text-blue-600" : "text-muted-foreground"}`} strokeWidth={isActive ? 2.5 : 2} />
                  {/* Role indicator dot on switch tab */}
                  {item.key === "switch" && (
                    <span className={`absolute top-2 right-3 w-2.5 h-2.5 rounded-full border border-background ${roleColors[userRole]}`} />
                  )}
                  <span className={`text-[10px] font-medium ${isActive || item.key === "switch" ? "text-blue-600" : "text-muted-foreground"}`}>{item.label}</span>
                </motion.button>
              )
            })}
          </nav>
        </div>

        {/* Role switcher popup */}
        <AnimatePresence>
          {showRoleMenu && (
            <motion.div
              ref={roleMenuRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-20 right-4 bg-card rounded-xl shadow-lg border border-border p-2 min-w-[160px]"
            >
              <p className="text-xs text-muted-foreground px-3 py-1.5 font-medium">Switch Role</p>
              {(["buyer", "seller", ...(['admin', 'manager'].includes(currentUser?.role || '') ? ["admin" as const, "manager" as const] : [])] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleSwitch(role)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    userRole === role
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${roleColors[role]}`} />
                  <span className="font-medium">{roleLabels[role]}</span>
                  {userRole === role && (
                    <Check className="w-3.5 h-3.5 ml-auto text-blue-600" />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ==================== SELLER BOTTOM NAV ====================
export function SellerBottomNav() {
  const { currentScreen, navigate, userRole, currentUser, originalRole, switchRole } = useAppStore()
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const roleMenuRef = useRef<HTMLDivElement>(null)

  const items = [
    { key: "seller-dashboard", label: "Home", icon: BarChart3, screen: "seller-dashboard" as ScreenName },
    { key: "seller-products", label: "Produk", icon: Package, screen: "seller-products" as ScreenName },
    { key: "seller-orders", label: "Pesanan", icon: ShoppingCart, screen: "seller-orders" as ScreenName },
    { key: "seller-chat", label: "Chat", icon: MessageCircle, screen: "seller-chat" as ScreenName },
    { key: "switch", label: "Switch", icon: Users, screen: null },
  ]

  const roleColors: Record<string, string> = {
    buyer: "bg-emerald-500",
    seller: "bg-orange-500",
    admin: "bg-purple-500",
    manager: "bg-violet-500",
  }

  const roleLabels: Record<string, string> = {
    buyer: "Buyer",
    seller: "Seller",
    admin: "Admin",
    manager: "Manager",
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setShowRoleMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleRoleSwitch = (role: "buyer" | "seller" | "admin" | "manager") => {
    switchRole(role)
    setShowRoleMenu(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[430px] md:max-w-[480px] relative">
        <div className="glass border-t border-border/50 pb-safe">
          <nav className="flex items-center justify-around h-16">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = item.key !== "switch" && currentScreen === item.screen
              return (
                <motion.button key={item.key} whileTap={{ scale: 0.9 }}
                  onClick={() => item.key === "switch" ? setShowRoleMenu(!showRoleMenu) : item.screen && navigate(item.screen)}
                  className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full"
                >
                  <Icon className={`w-5 h-5 ${isActive || item.key === "switch" ? "text-orange-600" : "text-muted-foreground"}`} strokeWidth={isActive ? 2.5 : 2} />
                  {/* Role indicator dot on switch tab */}
                  {item.key === "switch" && (
                    <span className={`absolute top-2 right-3 w-2.5 h-2.5 rounded-full border border-background ${roleColors[userRole]}`} />
                  )}
                  <span className={`text-[10px] font-medium ${isActive || item.key === "switch" ? "text-orange-600" : "text-muted-foreground"}`}>{item.label}</span>
                </motion.button>
              )
            })}
          </nav>
        </div>

        {/* Role switcher popup */}
        <AnimatePresence>
          {showRoleMenu && (
            <motion.div
              ref={roleMenuRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-20 right-4 bg-card rounded-xl shadow-lg border border-border p-2 min-w-[160px]"
            >
              <p className="text-xs text-muted-foreground px-3 py-1.5 font-medium">Switch Role</p>
              {(["buyer", "seller", ...(['admin', 'manager'].includes(currentUser?.role || '') ? ["admin" as const, "manager" as const] : [])] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleSwitch(role)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    userRole === role
                      ? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${roleColors[role]}`} />
                  <span className="font-medium">{roleLabels[role]}</span>
                  {userRole === role && (
                    <Check className="w-3.5 h-3.5 ml-auto text-orange-600" />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
