"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Heart, ShoppingCart, MessageCircle, User, Home, Grid3X3, Search, Star, Clock, ChevronRight, ArrowLeft, Bell, Settings, Plus, Minus, X, Check, Share2, Truck, Shield, RotateCcw, Zap, TrendingUp, Gift, Award, ChevronDown, Eye, Trash2, Edit, MoreVertical, Package, DollarSign, BarChart3, Users, Megaphone, Store, Wallet as WalletIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAppStore, useCartStore, useWishlistStore } from "@/lib/store"
import { formatPrice, formatRelativeTime } from "@/lib/mock-data"
import type { Product, ScreenName, OrderStatus } from "@/lib/types"
import { useState, useEffect, useCallback, useRef } from "react"

// ==================== BOTTOM NAV ====================
const navItems = [
  { key: "home" as const, label: "Home", icon: Home, screens: ["home", "splash", "onboarding", "login", "register", "otp", "forgot-password"] },
  { key: "category" as const, label: "Category", icon: Grid3X3, screens: ["category", "search"] },
  { key: "cart" as const, label: "Cart", icon: ShoppingCart, screens: ["cart", "checkout", "payment"] },
  { key: "chat" as const, label: "Chat", icon: MessageCircle, screens: ["chat", "chat-room"] },
  { key: "profile" as const, label: "Profile", icon: User, screens: ["profile", "settings", "orders", "wallet", "deposit", "withdraw", "notification", "voucher", "address", "followed-stores", "wishlist", "review", "refund", "help", "seller-dashboard", "seller-products", "seller-add-product", "seller-orders", "seller-analytics", "seller-chat", "seller-settings", "seller-campaign", "seller-wallet", "admin-dashboard", "admin-users", "admin-products", "admin-orders", "admin-withdraw", "admin-banner", "admin-analytics", "admin-complaints"] },
]

export function BottomNav() {
  const { currentScreen, navigate, userRole, switchRole, totalUnreadChats } = useAppStore()
  const { getCheckedCount } = useCartStore()
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const roleMenuRef = useRef<HTMLDivElement>(null)

  const cartCount = getCheckedCount()

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

  const handleRoleSwitch = (role: "buyer" | "seller" | "admin") => {
    switchRole(role)
    setShowRoleMenu(false)
  }

  const roleColors: Record<string, string> = {
    buyer: "bg-emerald-500",
    seller: "bg-orange-500",
    admin: "bg-purple-500",
  }

  const roleLabels: Record<string, string> = {
    buyer: "Buyer",
    seller: "Seller",
    admin: "Admin",
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
              {(["buyer", "seller", "admin"] as const).map((role) => (
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

// ==================== PRODUCT CARD ====================
interface ProductCardProps {
  product: Product
  onClick?: () => void
  layout?: "grid" | "list"
}

export function ProductCard({ product, onClick, layout = "grid" }: ProductCardProps) {
  const { toggleWishlist, isWishlisted } = useWishlistStore()
  const wishlisted = isWishlisted(product.id)
  const discountPercent = product.discountPrice
    ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
    : 0

  const colors = [
    "bg-emerald-100 dark:bg-emerald-900/30",
    "bg-orange-100 dark:bg-orange-900/30",
    "bg-pink-100 dark:bg-pink-900/30",
    "bg-violet-100 dark:bg-violet-900/30",
    "bg-cyan-100 dark:bg-cyan-900/30",
    "bg-amber-100 dark:bg-amber-900/30",
  ]
  const colorIndex = product.id.charCodeAt(0) % colors.length

  if (layout === "list") {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
        className="flex gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm cursor-pointer"
      >
        <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${colors[colorIndex]}`}>
              <span className="text-2xl font-bold text-emerald-600">
                {product.name.charAt(0)}
              </span>
            </div>
          )}
          {product.isFlashSale && (
            <div className="absolute top-1 left-1 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" />
              FLASH
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium line-clamp-2 leading-tight">{product.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{product.seller.storeName}</p>
          </div>
          <div className="flex items-end justify-between">
            <PriceDisplay
              price={product.price}
              discountPrice={product.discountPrice}
              size="sm"
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{product.rating}</span>
              <span>·</span>
              <span>{product.sold} terjual</span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden cursor-pointer"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover image-zoom"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${colors[colorIndex]}`}>
            <span className="text-4xl font-bold text-emerald-600/70">
              {product.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Discount badge */}
        {discountPercent > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
            -{discountPercent}%
          </div>
        )}

        {/* Flash sale badge */}
        {product.isFlashSale && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shimmer">
            <Zap className="w-2.5 h-2.5" />
            FLASH
          </div>
        )}

        {/* Wishlist button */}
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={(e) => {
            e.stopPropagation()
            toggleWishlist(product.id)
          }}
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-sm"
        >
          <motion.div
            animate={wishlisted ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <Heart
              className={`w-3.5 h-3.5 transition-colors ${
                wishlisted
                  ? "fill-red-500 text-red-500"
                  : "text-gray-500"
              }`}
            />
          </motion.div>
        </motion.button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-xs font-medium line-clamp-2 leading-tight min-h-[2rem]">
          {product.name}
        </h3>

        <PriceDisplay
          price={product.price}
          discountPrice={product.discountPrice}
          size="sm"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            <span>{product.rating}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {product.sold > 1000 ? `${(product.sold / 1000).toFixed(1)}rb` : product.sold} terjual
          </span>
        </div>

        <p className="text-[10px] text-muted-foreground truncate">
          {product.seller.storeName}
        </p>
      </div>
    </motion.div>
  )
}

// ==================== FLASH SALE TIMER ====================
interface FlashSaleTimerProps {
  endDate: string
  size?: "sm" | "md" | "lg"
}

function calculateTimeLeftFromEnd(endDate: string) {
  const end = new Date(endDate).getTime()
  const now = Date.now()
  const diff = Math.max(0, end - now)

  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0 }

  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  }
}

export function FlashSaleTimer({ endDate, size = "md" }: FlashSaleTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeftFromEnd(endDate))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeftFromEnd(endDate))
    }, 1000)

    return () => clearInterval(timer)
  }, [endDate])

  const sizeClasses = {
    sm: "text-xs min-w-[24px] h-6",
    md: "text-sm min-w-[30px] h-8",
    lg: "text-lg min-w-[40px] h-10",
  }

  const separatorSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
  }

  const pad = (n: number) => n.toString().padStart(2, "0")

  return (
    <div className="flex items-center gap-1">
      <Clock className={`${size === "sm" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-5 h-5"} text-orange-500`} />
      <div className="flex items-center gap-0.5">
        {[
          { value: pad(timeLeft.hours), label: "jam" },
          { value: pad(timeLeft.minutes), label: "min" },
          { value: pad(timeLeft.seconds), label: "det" },
        ].map((item, idx) => (
          <span key={item.label} className="flex items-center gap-0.5">
            <motion.span
              key={item.value}
              initial={{ y: -5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`${sizeClasses[size]} flex items-center justify-center bg-orange-500 text-white font-bold rounded-md px-1`}
            >
              {item.value}
            </motion.span>
            {idx < 2 && (
              <span className={`${separatorSizeClasses[size]} text-orange-500 font-bold`}>:</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

// ==================== CATEGORY PILL ====================
interface CategoryPillProps {
  id: string
  name: string
  icon?: string
  isActive?: boolean
  onClick?: () => void
}

export function CategoryPill({ name, icon, isActive, onClick }: CategoryPillProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
        isActive
          ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
          : "bg-card text-foreground border-border hover:bg-muted"
      }`}
    >
      {icon && <span className="text-base">{icon}</span>}
      <span>{name}</span>
    </motion.button>
  )
}

// ==================== CATEGORY PILL LIST ====================
interface CategoryPillListProps {
  categories: { id: string; name: string; icon?: string }[]
  activeId?: string | null
  onSelect?: (id: string) => void
}

export function CategoryPillList({ categories, activeId, onSelect }: CategoryPillListProps) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
      <CategoryPill
        id="all"
        name="Semua"
        icon="🏷️"
        isActive={!activeId}
        onClick={() => onSelect?.("")}
      />
      {categories.map((cat) => (
        <CategoryPill
          key={cat.id}
          id={cat.id}
          name={cat.name}
          icon={cat.icon}
          isActive={activeId === cat.id}
          onClick={() => onSelect?.(cat.id)}
        />
      ))}
    </div>
  )
}

// ==================== EMPTY STATE ====================
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
        {icon || <Package className="w-10 h-10 text-muted-foreground" />}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {subtitle && (
        <p className="text-sm text-muted-foreground max-w-[250px]">{subtitle}</p>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
          size="sm"
        >
          {actionLabel}
        </Button>
      )}
    </motion.div>
  )
}

// ==================== LOADING SKELETONS ====================
export function ProductCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden animate-pulse">
      <div className="aspect-square bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    </div>
  )
}

export function HomeScreenSkeleton() {
  return (
    <div className="space-y-6 p-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 bg-muted rounded-lg animate-pulse" />
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
          <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
        </div>
      </div>
      {/* Search skeleton */}
      <div className="h-10 bg-muted rounded-xl animate-pulse" />
      {/* Banner skeleton */}
      <div className="h-40 bg-muted rounded-2xl animate-pulse" />
      {/* Category skeleton */}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-muted rounded-xl animate-pulse" />
            <div className="h-3 w-12 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
      {/* Product grid skeleton */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 bg-card rounded-xl border border-border/50 animate-pulse">
          <div className="w-20 h-20 bg-muted rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-5 bg-muted rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ==================== SEARCH BAR ====================
interface SearchBarProps {
  value?: string
  onChange?: (value: string) => void
  onSearch?: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchBar({
  value: controlledValue,
  onChange,
  onSearch,
  placeholder = "Cari produk...",
  autoFocus = false,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState("")
  const value = controlledValue ?? internalValue
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue)
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange?.(newValue)
    }, 300)
  }

  const handleClear = () => {
    handleChange("")
    onChange?.("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.(value)
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pl-9 pr-9 h-10 rounded-xl bg-muted/50 border-border/50 focus:border-emerald-500 focus:ring-emerald-500/20"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2"
        >
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </form>
  )
}

// ==================== SECTION HEADER ====================
interface SectionHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  actionLabel = "Lihat Semua",
  onAction,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon && <span className="text-emerald-500">{icon}</span>}
        <div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-0.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          {actionLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ==================== STATUS BADGE ====================
interface StatusBadgeProps {
  status: OrderStatus
  size?: "sm" | "md"
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: {
    label: "Menunggu Pembayaran",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  paid: {
    label: "Dibayar",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  processing: {
    label: "Diproses",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  shipped: {
    label: "Dikirim",
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
  delivered: {
    label: "Selesai",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  cancelled: {
    label: "Dibatalkan",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  refunded: {
    label: "Dikembalikan",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400",
  },
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = statusConfig[status]
  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"

  return (
    <span className={`inline-flex items-center font-medium rounded-md ${config.className} ${sizeClasses}`}>
      {config.label}
    </span>
  )
}

// ==================== ROLE BADGE ====================
interface RoleBadgeProps {
  role: "buyer" | "seller" | "admin"
  size?: "sm" | "md"
}

const roleConfig: Record<string, { label: string; className: string }> = {
  buyer: {
    label: "Buyer",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  seller: {
    label: "Seller",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  admin: {
    label: "Admin",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
}

export function RoleBadge({ role, size = "sm" }: RoleBadgeProps) {
  const config = roleConfig[role]
  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"

  return (
    <span className={`inline-flex items-center font-medium rounded-md ${config.className} ${sizeClasses}`}>
      {config.label}
    </span>
  )
}

// ==================== RATING STARS ====================
interface RatingStarsProps {
  rating: number
  maxRating?: number
  size?: "sm" | "md" | "lg"
  showValue?: boolean
  reviewCount?: number
}

export function RatingStars({
  rating,
  maxRating = 5,
  size = "sm",
  showValue = true,
  reviewCount,
}: RatingStarsProps) {
  const sizeMap = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  }
  const textSizeMap = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxRating }).map((_, i) => {
          const filled = rating >= i + 1
          const halfFilled = !filled && rating >= i + 0.5

          return (
            <span key={i} className="relative">
              <Star
                className={`${sizeMap[size]} text-gray-300 dark:text-gray-600`}
              />
              {(filled || halfFilled) && (
                <Star
                  className={`${sizeMap[size]} absolute inset-0 fill-amber-400 text-amber-400`}
                  style={
                    halfFilled
                      ? { clipPath: "inset(0 50% 0 0)" }
                      : undefined
                  }
                />
              )}
            </span>
          )
        })}
      </div>
      {showValue && (
        <span className={`${textSizeMap[size]} font-medium text-foreground`}>
          {rating.toFixed(1)}
        </span>
      )}
      {reviewCount !== undefined && (
        <span className={`${textSizeMap[size]} text-muted-foreground`}>
          ({reviewCount.toLocaleString()})
        </span>
      )}
    </div>
  )
}

// ==================== PRICE DISPLAY ====================
interface PriceDisplayProps {
  price: number
  discountPrice?: number
  size?: "sm" | "md" | "lg"
  showDiscount?: boolean
}

export function PriceDisplay({
  price,
  discountPrice,
  size = "md",
  showDiscount = true,
}: PriceDisplayProps) {
  const sizeMap = {
    sm: { main: "text-xs", original: "text-[10px]" },
    md: { main: "text-sm", original: "text-xs" },
    lg: { main: "text-lg", original: "text-sm" },
  }

  const discountPercent =
    discountPrice && showDiscount
      ? Math.round(((price - discountPrice) / price) * 100)
      : 0

  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className={`${sizeMap[size].main} font-bold text-emerald-600`}>
        {formatPrice(discountPrice || price)}
      </span>
      {discountPrice && showDiscount && (
        <>
          <span className={`${sizeMap[size].original} text-muted-foreground line-through`}>
            {formatPrice(price)}
          </span>
          {discountPercent > 0 && (
            <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1 py-0.5 rounded">
              -{discountPercent}%
            </span>
          )}
        </>
      )}
    </div>
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
          />
        ) : (
          <div
            className={`${s.avatar} rounded-full ${colors[colorIndex]} text-white font-bold flex items-center justify-center`}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
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

// ==================== QUANTITY SELECTOR ====================
interface QuantitySelectorProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: "sm" | "md"
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 999,
  size = "md",
}: QuantitySelectorProps) {
  const sizeMap = {
    sm: { button: "w-7 h-7", text: "text-xs w-8", icon: "w-3 h-3" },
    md: { button: "w-9 h-9", text: "text-sm w-10", icon: "w-4 h-4" },
  }
  const s = sizeMap[size]

  return (
    <div className="flex items-center gap-1">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={`${s.button} flex items-center justify-center rounded-lg border border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors`}
      >
        <Minus className={s.icon} />
      </motion.button>
      <span className={`${s.text} text-center font-semibold text-foreground`}>
        {value}
      </span>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={`${s.button} flex items-center justify-center rounded-lg border border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors`}
      >
        <Plus className={s.icon} />
      </motion.button>
    </div>
  )
}

// ==================== PAGE HEADER ====================
interface PageHeaderProps {
  title: string
  showBack?: boolean
  onBack?: () => void
  rightAction?: React.ReactNode
}

export function PageHeader({ title, showBack = true, onBack, rightAction }: PageHeaderProps) {
  const { goBack } = useAppStore()

  return (
    <div className="sticky top-0 z-40 glass">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          {showBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack || goBack}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
          )}
          <h1 className="text-base font-bold text-foreground">{title}</h1>
        </div>
        {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
      </div>
    </div>
  )
}

// ==================== FEATURE CHIP ====================
interface FeatureChipProps {
  icon: React.ReactNode
  label: string
}

export function FeatureChip({ icon, label }: FeatureChipProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  )
}

// ==================== PRODUCT FEATURES (shipping guarantees) ====================
export function ProductGuarantees() {
  return (
    <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-xl">
      <FeatureChip
        icon={<Truck className="w-4 h-4 text-emerald-500" />}
        label="Gratis Ongkir"
      />
      <FeatureChip
        icon={<Shield className="w-4 h-4 text-emerald-500" />}
        label="Garansi 7 Hari"
      />
      <FeatureChip
        icon={<RotateCcw className="w-4 h-4 text-emerald-500" />}
        label="Bisa Return"
      />
    </div>
  )
}

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

// ==================== SELLER BADGE ====================
interface SellerBadgeProps {
  isVerified?: boolean
  isPremium?: boolean
  size?: "sm" | "md"
}

export function SellerBadge({ isVerified, isPremium, size = "sm" }: SellerBadgeProps) {
  const sizeClasses = size === "sm" ? "text-[9px] px-1 py-0.5" : "text-[10px] px-1.5 py-0.5"

  return (
    <div className="flex items-center gap-1">
      {isVerified && (
        <span className={`${sizeClasses} inline-flex items-center gap-0.5 font-medium rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`}>
          <Check className="w-2.5 h-2.5" />
          Verified
        </span>
      )}
      {isPremium && (
        <span className={`${sizeClasses} inline-flex items-center gap-0.5 font-medium rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`}>
          <Award className="w-2.5 h-2.5" />
          Premium
        </span>
      )}
    </div>
  )
}

// ==================== COUNTER ANIMATION ====================
interface AnimatedCounterProps {
  value: number
  format?: (v: number) => string
}

export function AnimatedCounter({ value, format }: AnimatedCounterProps) {
  return (
    <motion.span
      key={value}
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="font-bold tabular-nums"
    >
      {format ? format(value) : value}
    </motion.span>
  )
}

// ==================== TAB BAR ====================
interface TabBarProps {
  tabs: { key: string; label: string; count?: number }[]
  activeTab: string
  onTabChange: (key: string) => void
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex border-b border-border overflow-x-auto no-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
            activeTab === tab.key
              ? "text-emerald-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{tab.label}</span>
          {tab.count !== undefined && tab.count > 0 && (
            <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${
              activeTab === tab.key
                ? "bg-emerald-500 text-white"
                : "bg-muted text-muted-foreground"
            }`}>
              {tab.count > 99 ? "99+" : tab.count}
            </span>
          )}
          {activeTab === tab.key && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

// ==================== VOUCHER CARD ====================
interface VoucherCardProps {
  code: string
  name: string
  description?: string
  validUntil: string
  isActive?: boolean
  isClaimed?: boolean
  onClaim?: () => void
}

export function VoucherCard({
  code,
  name,
  description,
  validUntil,
  isActive = true,
  isClaimed = false,
  onClaim,
}: VoucherCardProps) {
  return (
    <div className="relative flex overflow-hidden rounded-xl border border-border bg-card">
      {/* Left accent */}
      <div className="w-1.5 bg-emerald-500 flex-shrink-0" />
      {/* Content */}
      <div className="flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-foreground">{name}</h4>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <Badge variant="outline" className="text-[9px] font-bold text-emerald-600 border-emerald-200 dark:border-emerald-800">
            {code}
          </Badge>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-muted-foreground">
            s/d {new Date(validUntil).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          {onClaim && !isClaimed && isActive && (
            <Button
              size="sm"
              onClick={onClaim}
              className="h-7 text-xs rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Pakai
            </Button>
          )}
          {isClaimed && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" />
              Digunakan
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== WALLET BALANCE CARD ====================
interface WalletBalanceCardProps {
  balance: number
  coins: number
  onTopUp?: () => void
  onWithdraw?: () => void
}

export function WalletBalanceCard({ balance, coins, onTopUp, onWithdraw }: WalletBalanceCardProps) {
  return (
    <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium opacity-90">Saldo MartPay</span>
        <DollarSign className="w-5 h-5 opacity-70" />
      </div>
      <p className="text-2xl font-bold mb-1">{formatPrice(balance)}</p>
      <div className="flex items-center gap-1 text-xs opacity-80 mb-4">
        <Gift className="w-3.5 h-3.5" />
        <span>{coins} Koin</span>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onTopUp}
          className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl backdrop-blur-sm"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Top Up
        </Button>
        <Button
          size="sm"
          onClick={onWithdraw}
          variant="outline"
          className="flex-1 bg-transparent hover:bg-white/10 text-white border-white/30 rounded-xl"
        >
          Tarik
        </Button>
      </div>
    </div>
  )
}

// ==================== STORE CARD ====================
interface StoreCardProps {
  storeName: string
  storeAvatar?: string
  isVerified?: boolean
  isPremium?: boolean
  rating: number
  totalSales: number
  totalProducts: number
  onClick?: () => void
}

export function StoreCard({
  storeName,
  storeAvatar,
  isVerified,
  isPremium,
  rating,
  totalSales,
  totalProducts,
  onClick,
}: StoreCardProps) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50 cursor-pointer"
    >
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
        {storeAvatar ? (
          <img src={storeAvatar} alt={storeName} className="w-full h-full object-cover" />
        ) : (
          <Store className="w-6 h-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-sm font-medium text-foreground truncate">{storeName}</h4>
          <SellerBadge isVerified={isVerified} isPremium={isPremium} size="sm" />
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {rating}
          </span>
          <span>{totalSales.toLocaleString()} terjual</span>
          <span>{totalProducts} produk</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </motion.div>
  )
}

// ==================== ADMIN BOTTOM NAV ====================
export function AdminBottomNav() {
  const { currentScreen, navigate, userRole, switchRole } = useAppStore()
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
  }

  const roleLabels: Record<string, string> = {
    buyer: "Buyer",
    seller: "Seller",
    admin: "Admin",
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

  const handleRoleSwitch = (role: "buyer" | "seller" | "admin") => {
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
              {(["buyer", "seller", "admin"] as const).map((role) => (
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
  const { currentScreen, navigate, userRole, switchRole } = useAppStore()
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
  }

  const roleLabels: Record<string, string> = {
    buyer: "Buyer",
    seller: "Seller",
    admin: "Admin",
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

  const handleRoleSwitch = (role: "buyer" | "seller" | "admin") => {
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
              {(["buyer", "seller", "admin"] as const).map((role) => (
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
