"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Search, Bell, MessageCircle, ChevronRight, Zap } from "lucide-react"
import { useAppStore, useCartStore } from "@/lib/store"
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from "@/lib/mock-data"
import { ProductCard, FlashSaleTimer, CategoryPill, SectionHeader } from "./shared"
import type { Product } from "@/lib/types"
import { useState, useEffect, useCallback, useRef } from "react"

// ==================== BANNER DATA ====================
const banners = [
  {
    id: "b1",
    title: "Mega Sale 🔥",
    subtitle: "Diskon hingga 70%",
    gradient: "from-emerald-600 to-teal-500",
  },
  {
    id: "b2",
    title: "Diskon 70%",
    subtitle: "Khusus hari ini!",
    gradient: "from-orange-500 to-amber-400",
  },
  {
    id: "b3",
    title: "Gratis Ongkir 🚚",
    subtitle: "Min. belanja Rp50.000",
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    id: "b4",
    title: "Cashback 20% 💰",
    subtitle: "Bayar pakai MartUp Pay",
    gradient: "from-violet-500 to-purple-500",
  },
]

// ==================== QUICK ACTIONS DATA ====================
const quickActionsRow1 = [
  { icon: "⚡", label: "Flash Sale", key: "flash-sale" },
  { icon: "🎫", label: "Voucher", key: "voucher" },
  { icon: "💰", label: "Top-Up", key: "topup" },
  { icon: "🚚", label: "Gratis Ongkir", key: "free-ship" },
  { icon: "🪙", label: "Coin", key: "coin" },
]

const quickActionsRow2 = [
  { icon: "📺", label: "Live", key: "live" },
  { icon: "🔥", label: "Baru", key: "new" },
  { icon: "🇮🇩", label: "Lokal", key: "local" },
  { icon: "🎪", label: "Badut", key: "promo" },
  { icon: "➕", label: "Lainnya", key: "more" },
]

// ==================== HOME SCREEN ====================
export function HomeScreen() {
  const { navigate, unreadNotificationCount, totalUnreadChats, setSelectedProduct, setSearchQuery, showToast } = useAppStore()
  const [currentBanner, setCurrentBanner] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showLoadingMore, setShowLoadingMore] = useState(false)

  // Handle quick action button clicks
  const handleQuickAction = useCallback((key: string) => {
    switch (key) {
      case "flash-sale":
        setSearchQuery("Flash Sale")
        navigate("search")
        break
      case "voucher":
        navigate("voucher")
        break
      case "topup":
        navigate("deposit")
        break
      case "free-ship":
        setSearchQuery("Gratis Ongkir")
        navigate("search")
        break
      case "coin":
        navigate("wallet")
        break
      case "live":
        showToast("Fitur Live Streaming segera hadir!", "info")
        break
      case "new":
        setSearchQuery("Baru")
        navigate("search")
        break
      case "local":
        navigate("category")
        break
      case "promo":
        navigate("voucher")
        break
      case "more":
        showToast("Menu lainnya segera hadir!", "info")
        break
    }
  }, [setSearchQuery, navigate, showToast])

  // Handle banner click
  const handleBannerClick = useCallback(() => {
    if (currentBanner === 0 || currentBanner === 1) {
      setSearchQuery("Flash Sale")
      navigate("search")
    } else if (currentBanner === 2) {
      navigate("voucher")
    } else if (currentBanner === 3) {
      navigate("wallet")
    }
  }, [currentBanner, setSearchQuery, navigate])

  // Auto-play banner carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [])

  // Filter products for flash sale
  const flashSaleProducts = MOCK_PRODUCTS.filter((p) => p.isFlashSale)

  // Filter products by category for the feed
  const filteredProducts = selectedCategory
    ? MOCK_PRODUCTS.filter((p) => p.categoryId === selectedCategory)
    : MOCK_PRODUCTS

  // Handle product click
  const handleProductClick = useCallback(
    (product: Product) => {
      setSelectedProduct(product.id)
      navigate("product-detail")
    },
    [setSelectedProduct, navigate]
  )

  // Infinite scroll placeholder
  const feedRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShowLoadingMore(true)
          setTimeout(() => setShowLoadingMore(false), 1500)
        }
      },
      { threshold: 1.0 }
    )

    const sentinelEl = document.getElementById("feed-sentinel")
    if (sentinelEl) observer.observe(sentinelEl)

    return () => observer.disconnect()
  }, [filteredProducts])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-background pb-20"
    >
      {/* ===== TOP BAR ===== */}
      <div className="sticky top-0 z-40 glass">
        <div className="flex items-center gap-3 px-4 h-14">
          {/* Logo */}
          <span className="text-xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent flex-shrink-0">
            MartUp
          </span>

          {/* Search bar */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("search")}
            className="flex-1 flex items-center gap-2 h-9 px-3 rounded-xl bg-muted/60 border border-border/50 text-muted-foreground text-sm"
          >
            <Search className="w-4 h-4" />
            <span>Cari produk...</span>
          </motion.button>

          {/* Notification bell */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("notification")}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <Bell className="w-5 h-5 text-foreground" />
            {unreadNotificationCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1"
              >
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </motion.span>
            )}
          </motion.button>

          {/* Chat icon */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("chat")}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-foreground" />
            {totalUnreadChats > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1"
              >
                {totalUnreadChats > 99 ? "99+" : totalUnreadChats}
              </motion.span>
            )}
          </motion.button>
        </div>
      </div>

      {/* ===== BANNER CAROUSEL ===== */}
      <div className="px-4 pt-3">
        <div className="relative h-36 rounded-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentBanner}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              onClick={handleBannerClick}
              className={`absolute inset-0 bg-gradient-to-r ${banners[currentBanner].gradient} flex flex-col items-center justify-center text-white cursor-pointer`}
            >
              <h2 className="text-2xl font-extrabold drop-shadow-sm">
                {banners[currentBanner].title}
              </h2>
              <p className="text-sm font-medium opacity-90 mt-1">
                {banners[currentBanner].subtitle}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentBanner(idx)}
                className="focus:outline-none"
              >
                <motion.div
                  animate={{
                    width: idx === currentBanner ? 20 : 6,
                    backgroundColor: idx === currentBanner ? "#ffffff" : "rgba(255,255,255,0.5)",
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-1.5 rounded-full"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== QUICK ACTIONS ===== */}
      <div className="px-4 pt-4 space-y-3">
        {/* Row 1 */}
        <div className="grid grid-cols-5 gap-2">
          {quickActionsRow1.map((action) => (
            <motion.button
              key={action.key}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleQuickAction(action.key)}
              className="flex flex-col items-center gap-1.5 py-2"
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-[10px] font-medium text-foreground leading-tight text-center">
                {action.label}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-5 gap-2">
          {quickActionsRow2.map((action) => (
            <motion.button
              key={action.key}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleQuickAction(action.key)}
              className="flex flex-col items-center gap-1.5 py-2"
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-[10px] font-medium text-foreground leading-tight text-center">
                {action.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ===== FLASH SALE SECTION ===== */}
      {flashSaleProducts.length > 0 && (
        <div className="pt-5">
          <div className="px-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-bold text-foreground">Flash Sale</h2>
                <FlashSaleTimer
                  endDate={flashSaleProducts[0].flashSaleEnd || "2025-12-31T23:59:59Z"}
                  size="sm"
                />
              </div>
              <button
                onClick={() => {
                  setSearchQuery("Flash Sale")
                  navigate("search")
                }}
                className="flex items-center gap-0.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Lihat Semua
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Horizontal scrollable flash sale cards */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
            {flashSaleProducts.map((product) => (
              <motion.div
                key={product.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleProductClick(product)}
                className="flex-shrink-0 w-[130px] bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden cursor-pointer"
              >
                {/* Image */}
                <div className="relative aspect-square overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-orange-100 dark:bg-orange-900/30">
                      <span className="text-xl font-bold text-orange-500">
                        {product.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  {/* Discount badge */}
                  {product.discountPrice && (
                    <div className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                      -{Math.round(((product.price - product.discountPrice) / product.price) * 100)}%
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-2 space-y-1">
                  <h3 className="text-[11px] font-medium line-clamp-2 leading-tight min-h-[1.5rem]">
                    {product.name}
                  </h3>
                  {product.discountPrice && (
                    <p className="text-xs font-bold text-emerald-600">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(product.discountPrice)}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {product.sold > 1000
                      ? `${(product.sold / 1000).toFixed(1)}rb`
                      : product.sold}{" "}
                    terjual
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CATEGORY SECTION ===== */}
      <div className="pt-5 px-4">
        <SectionHeader
          title="Kategori Pilihan"
          onAction={() => navigate("category")}
          actionLabel="Lihat Semua"
        />
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {MOCK_CATEGORIES.slice(0, 10).map((cat) => (
            <CategoryPill
              key={cat.id}
              id={cat.id}
              name={cat.name}
              icon={cat.icon}
              isActive={selectedCategory === cat.id}
              onClick={() =>
                setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
              }
            />
          ))}
        </div>
      </div>

      {/* ===== PRODUCT FEED ===== */}
      <div className="pt-5 px-4" ref={feedRef}>
        <SectionHeader
          title="Rekomendasi Untukmu"
          subtitle="Berdasarkan preferensimu"
          onAction={() => navigate("search")}
          actionLabel="Lihat Semua"
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          {filteredProducts.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
            >
              <ProductCard
                product={product}
                onClick={() => handleProductClick(product)}
                layout="grid"
              />
            </motion.div>
          ))}
        </div>

        {/* Infinite scroll sentinel & loading indicator */}
        <div id="feed-sentinel" className="h-4" />

        <AnimatePresence>
          {showLoadingMore && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-6 gap-2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
              />
              <span className="text-sm text-muted-foreground">Memuat lebih banyak...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
